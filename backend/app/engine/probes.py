import socket
import time
import subprocess
import platform
import re
from typing import Tuple, Optional

class ProbeResult:
    def __init__(self, success: bool, latency_ms: Optional[float] = None, error_message: Optional[str] = None):
        self.success = success
        self.latency_ms = round(latency_ms, 2) if latency_ms is not None else None
        self.error_message = error_message

    def to_tuple(self) -> Tuple[bool, Optional[float], Optional[str]]:
        return self.success, self.latency_ms, self.error_message

def ping_probe(addr: str, timeout_sec: int = 3) -> ProbeResult:
    """ICMP Ping 探针：跨平台执行真实系统 ping 探测并解析耗时与结果"""
    timeout_ms = timeout_sec * 1000
    is_win = platform.system().lower() == "windows"
    cmd = (
        ["ping", "-n", "1", "-w", str(timeout_ms), addr]
        if is_win
        else ["ping", "-c", "1", "-W", str(timeout_sec), addr]
    )

    si = None
    if is_win:
        si = subprocess.STARTUPINFO()
        si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        si.wShowWindow = subprocess.SW_HIDE

    t0 = time.perf_counter()
    try:
        res = subprocess.run(
            cmd,
            startupinfo=si,
            capture_output=True,
            text=True,
            encoding="gbk" if is_win else "utf-8",
            errors="ignore",
            timeout=timeout_sec + 2
        )
        elapsed_ms = (time.perf_counter() - t0) * 1000

        if is_win:
            out = res.stdout.lower()
            # 严格过滤伪在线、网关不可达代回与超时提示
            is_success = (
                res.returncode == 0
                and "ttl=" in out
                and "unreachable" not in out
                and "无法访问" not in out
                and "目标主机不可达" not in out
                and "超时" not in out
                and "timed out" not in out
            )
            # 尝试从输出中提取实际往返时间
            m = re.search(r"时间[=<](\d+)ms", res.stdout) or re.search(r"time[=<](\d+)ms", out)
            if m:
                actual_ms = float(m.group(1))
            else:
                actual_ms = elapsed_ms if is_success else None

            if is_success:
                return ProbeResult(True, latency_ms=actual_ms)
            else:
                return ProbeResult(False, latency_ms=None, error_message="Ping 超时或不可达")
        else:
            if res.returncode == 0:
                m = re.search(r"time=([0-9.]+)\s*ms", res.stdout)
                actual_ms = float(m.group(1)) if m else elapsed_ms
                return ProbeResult(True, latency_ms=actual_ms)
            return ProbeResult(False, latency_ms=None, error_message="Ping 超时或不可达")

    except subprocess.TimeoutExpired:
        return ProbeResult(False, latency_ms=None, error_message=f"Ping 超过设定超时 ({timeout_sec}s)")
    except Exception as e:
        return ProbeResult(False, latency_ms=None, error_message=f"Ping 异常: {str(e)}")

def tcp_probe(addr: str, port: int, timeout_sec: int = 3) -> ProbeResult:
    """TCP 端口探针：建立连接并立即释放套接字，精准捕获握手延迟"""
    if not port or port < 1 or port > 65535:
        return ProbeResult(False, None, f"无效的端口号: {port}")

    t0 = time.perf_counter()
    sock = None
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout_sec)
        sock.connect((addr, port))
        elapsed_ms = (time.perf_counter() - t0) * 1000
        return ProbeResult(True, latency_ms=elapsed_ms)
    except socket.timeout:
        return ProbeResult(False, None, f"TCP 连接超时 ({timeout_sec}s)")
    except ConnectionRefusedError:
        return ProbeResult(False, None, f"目标端口 {port} 连接被拒绝 (Connection Refused)")
    except OSError as e:
        return ProbeResult(False, None, f"TCP 连接失败: {str(e)}")
    except Exception as e:
        return ProbeResult(False, None, f"TCP 异常: {str(e)}")
    finally:
        if sock:
            try:
                sock.close()
            except Exception:
                pass

def arp_probe(addr: str, timeout_sec: int = 3) -> ProbeResult:
    """
    ARP 局域网探针：
    - Windows: 优先通过 iphlpapi.SendARP 原生调用
    - Linux / 容器: 检查 /proc/net/arp 或 ip neigh。若处于无权限或跨子网环境，明确报告不可用，绝不伪装成功
    """
    t0 = time.perf_counter()
    if platform.system() == "Windows":
        try:
            import ctypes
            dest_ip = ctypes.c_ulong(int.from_bytes(socket.inet_aton(addr), 'little'))
            src_ip = ctypes.c_ulong(0)
            mac = (ctypes.c_ubyte * 6)()
            mac_len = ctypes.c_ulong(6)
            res = ctypes.windll.iphlpapi.SendARP(dest_ip, src_ip, ctypes.byref(mac), ctypes.byref(mac_len))
            elapsed_ms = (time.perf_counter() - t0) * 1000
            if res == 0:
                mac_str = ":".join(f"{b:02x}" for b in mac)
                return ProbeResult(True, latency_ms=elapsed_ms, error_message=None)
            else:
                return ProbeResult(False, None, f"Windows SendARP 返回状态码: {res} (二层未响应)")
        except Exception as e:
            # 回退子进程 ping + arp -a 验证
            try:
                si = subprocess.STARTUPINFO()
                si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                si.wShowWindow = subprocess.SW_HIDE
                subprocess.run(["ping", "-n", "1", "-w", "500", addr], capture_output=True, startupinfo=si, stderr=subprocess.DEVNULL)
                res = subprocess.run(["arp", "-a", addr], capture_output=True, text=True, encoding="gbk", errors="ignore", timeout=2)
                elapsed_ms = (time.perf_counter() - t0) * 1000
                if re.search(r"([0-9a-f]{2}-){5}[0-9a-f]{2}", res.stdout.lower()):
                    return ProbeResult(True, latency_ms=elapsed_ms)
                return ProbeResult(False, None, "ARP 缓存未解析到有效物理地址")
            except Exception as ex:
                return ProbeResult(False, None, f"ARP 探测异常: {str(ex)}")

    elif platform.system() == "Linux":
        try:
            # 尝试通过 /proc/net/arp 读取
            with open("/proc/net/arp", "r") as f:
                lines = f.readlines()
            for line in lines[1:]:
                parts = line.split()
                if len(parts) >= 4 and parts[0] == addr:
                    hw_addr = parts[3]
                    if hw_addr != "00:00:00:00:00:00":
                        elapsed_ms = (time.perf_counter() - t0) * 1000
                        return ProbeResult(True, latency_ms=elapsed_ms)
            
            # 若 arp 缓存无记录，尝试发送一次 ping 触发 arp 学习
            subprocess.run(["ping", "-c", "1", "-W", "1", addr], capture_output=True)
            with open("/proc/net/arp", "r") as f:
                lines = f.readlines()
            for line in lines[1:]:
                parts = line.split()
                if len(parts) >= 4 and parts[0] == addr and parts[3] != "00:00:00:00:00:00":
                    elapsed_ms = (time.perf_counter() - t0) * 1000
                    return ProbeResult(True, latency_ms=elapsed_ms)
            return ProbeResult(False, None, "Linux ARP 缓存中未找到有效 MAC 记录 (目标可能不在线或跨三层网段)")
        except Exception as e:
            return ProbeResult(False, None, f"当前容器/环境无法访问 ARP 接口: {str(e)}")
    else:
        return ProbeResult(False, None, f"当前操作系统 {platform.system()} 暂不支持 ARP 二层探针")

def execute_probe(method: str, addr: str, port: Optional[int] = None, timeout_sec: int = 3) -> ProbeResult:
    """统一探针分发入口"""
    method = (method or "ping").strip().lower()
    if method == "ping":
        return ping_probe(addr, timeout_sec=timeout_sec)
    elif method == "tcp":
        return tcp_probe(addr, port=port or 80, timeout_sec=timeout_sec)
    elif method == "arp":
        return arp_probe(addr, timeout_sec=timeout_sec)
    else:
        return ProbeResult(False, None, f"不支持的探测协议: {method}")
