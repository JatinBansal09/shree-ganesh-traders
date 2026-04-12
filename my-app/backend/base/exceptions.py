from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import NotAuthenticated


def custom_exception_handler(exc, context):
    """
    Ensure authentication failures return 401 instead of 403
    """

    response = exception_handler(exc, context)

    # Explicit unauthenticated case
    if isinstance(exc, NotAuthenticated):
        return Response(
            {
                "detail": "Session expired. Please login again.",
                "authenticated": False,
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Convert 403 auth errors → 401
    if response is not None and response.status_code == status.HTTP_403_FORBIDDEN:
        response.status_code = status.HTTP_401_UNAUTHORIZED
        response.data = {
            "detail": "Session expired. Please login again.",
            "authenticated": False,
        }

    return response