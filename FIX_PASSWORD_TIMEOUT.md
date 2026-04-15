# Password Change Screen Timeout Fix

**Bug**: First password change → times out back to login ~30-60s.

**Root Cause**: Idle timeout applies, no activity listeners.

**Fix Plan**:

1. Import useEffect in ChangePasswordPage.jsx
2. Add setLastActivity = useAuth()
3. Add resetIdle + useEffect with document events (mousemove etc.)
