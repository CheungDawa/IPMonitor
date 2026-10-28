from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from backend.app.core.response import error_response

class AppException(Exception):
    def __init__(self, message: str, code: int = 400, data: any = None):
        self.message = message
        self.code = code
        self.data = data
        super().__init__(message)

class NotFoundException(AppException):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, code=404)

class ValidationException(AppException):
    def __init__(self, message: str = "Validation error", data: any = None):
        super().__init__(message, code=422, data=data)

class AuthenticationException(AppException):
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message, code=401)

class PermissionException(AppException):
    def __init__(self, message: str = "Permission denied"):
        super().__init__(message, code=403)

async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.code if exc.code in (400, 401, 403, 404, 422, 500) else 400,
        content=error_response(message=exc.message, code=exc.code, data=exc.data)
    )

from fastapi.encoders import jsonable_encoder

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    msg = "; ".join([f"{e.get('loc', ['field'])[-1]}: {e.get('msg', 'invalid')}" for e in errors])
    serializable_errors = jsonable_encoder(errors)
    return JSONResponse(
        status_code=422,
        content=error_response(message=f"参数验证失败: {msg}", code=422, data=serializable_errors)
    )

async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=error_response(message=f"服务器内部异常: {str(exc)}", code=500)
    )
