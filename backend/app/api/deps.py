from typing import Generator, Optional
from fastapi import Depends, Header
from sqlalchemy.orm import Session
from backend.app.core.database import SessionLocal, get_db
from backend.app.core.security import decode_access_token
from backend.app.core.exceptions import AuthenticationException, PermissionException
from backend.app.models.user import User

def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise AuthenticationException("缺少或无效的认证令牌 (Missing or invalid Bearer token)")
    
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise AuthenticationException("令牌已过期或签名无效")
    
    username = payload["sub"]
    user = db.query(User).filter(User.username == username, User.is_active == True).first()
    if not user:
        raise AuthenticationException("用户不存在或已被禁用")
    return user

def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise PermissionException("该操作需要系统管理员权限")
    return current_user
