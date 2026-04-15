# Notification Persistence Fix - TODO

## Plan Steps:

- [x] Step 1: Edit src/context/index.jsx to add localStorage persistence for readIds (load on init, save on update)
- [ ] Step 2: Test functionality (mark read, refresh browser, verify status persists)
- [ ] Step 3: Complete task

Current progress: Step 1 complete. Test by running the dev server, marking notifications as read, then refreshing the page - they should remain read. Key storage key: 'margube_readNotifs'
