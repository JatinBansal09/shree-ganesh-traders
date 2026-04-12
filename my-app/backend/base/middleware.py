# middleware.py - FIXED

from django.utils import timezone
from django.contrib.auth import logout
from django.http import JsonResponse
from django.shortcuts import redirect
from .models import UserSession
from .views import get_device_fingerprint


class AutoLogoutMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated:
            try:
                expiry_age = request.session.get_expiry_age()
                
                if expiry_age <= 0:
                    print(f"⏰ Session expired for: {request.user.username}")
                    
                    # ⬇️ NEW: Save user_id BEFORE logout
                    user_id = request.user.id
                    username = request.user.username
                    
                    # Update UserSession
                    device_hash = get_device_fingerprint(request)
                    UserSession.objects.filter(
                        user_id=user_id,  # ⬅️ Use saved user_id
                        device_fingerprint=device_hash,
                    ).update(logged_out_at=timezone.now())
                    
                    print(f"💾 UserSession updated for user_id={user_id}")
                    
                    # Now logout (deletes session)
                    logout(request)
                    
                    if request.path.startswith('/api/'):
                        return JsonResponse(
                            {"detail": "Session expired. Please login again."},
                            status=401
                        )
                    else:
                        return redirect('/login')
                        
            except Exception as e:
                print(f"Middleware error: {e}")
        
        return self.get_response(request)