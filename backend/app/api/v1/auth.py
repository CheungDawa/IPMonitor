from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.app.core.database import get_db
from backend.app.core.security import verify_password, hash_password, create_access_token
from backend.app.core.response import success_response
from backend.app.core.exceptions import AuthenticationException, ValidationException
from backend.app.models.user import User
from backend.app.schemas.user import UserLogin, UserPasswordUpdate, UserResponse
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["认证模块"])

@router.post("/login")
def login(req: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise AuthenticationException("用户名或密码错误")
    
    if not user.is_active:
        raise AuthenticationException("该用户账号已被停用")
        
    token = create_access_token(user.username)
    return success_response(data={
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "email": user.email,
            "is_active": user.is_active,
            "is_default_password": req.password == "admin123"
        }
    }, message="登录成功")

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return success_response(data={
        "id": current_user.id,
        "username": current_user.username,
        "role": current_user.role,
        "email": current_user.email,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None
    })

@router.post("/password")
def change_password(
    req: UserPasswordUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not verify_password(req.old_password, current_user.password_hash):
        raise ValidationException("原密码不正确")
    
    if len(req.new_password) < 6:
        raise ValidationException("新密码长度不能少于 6 位")
        
    current_user.password_hash = hash_password(req.new_password)
    db.commit()
    return success_response(message="密码修改成功，请使用新密码重新登录")
