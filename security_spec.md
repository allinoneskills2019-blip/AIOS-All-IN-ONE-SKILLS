# Security Specification — All in One Skill

## 1. Data Invariants
1. **Identity Integrity**: Every user-owned document (`technicians`, `shops`, `products`, `contractors`, `projects`, `bookings`, `orders`, `enquiries`, `complaints`, `transactions`) must match `request.auth.uid` on creation and never change its owner UID (`ownerId`, `customerId`, `contractorId`, `reporterId`, `userId`) on update.
2. **PII Isolation**: Private fields (`phone`, `email`, `fullAddress`, `aadhaarLast4`, `upiOrBankRef`) live strictly in `/users/{userId}/private/{docId}` and are readable/writable only by the owning user or an administrator. Public catalog documents (`technicians`, `shops`, `products`, `contractors`, `projects`) prohibit PII keys via strict `.keys().hasOnly(...)` allowlists.
3. **Role Privilege Protection**: Users cannot self-assign `role: "admin"` during registration or profile updates. Admin privileges derive strictly from `/admins/{uid}` or the verified runtime owner email (`allinoneskills2019@gmail.com` with `email_verified == true`).
4. **Terminal State Locking**: Completed/Cancelled/Verified financial transactions, bookings, and orders cannot be reverted or modified by non-admins once in terminal states.
5. **Temporal Integrity**: `createdAt` and `updatedAt` must equal `request.time` on creation, and `updatedAt == request.time` on update with `createdAt` immutable.
6. **Verified Accounts**: Standard write operations require either `request.auth.token.email_verified == true` or a verified Firebase Phone Auth `phone_number`.

## 2. "Dirty Dozen" Adversarial Payloads (Expected: PERMISSION_DENIED)
1. **Self-Assigned Admin**: `users/{uid}` create with `{ role: "admin" }` by non-admin.
2. **Email Spoof Attack**: Write as user with `email: "allinoneskills2019@gmail.com"` and `email_verified: false`.
3. **Ghost Field Injection**: `technicians/{id}` create with extra `{ isSuperVerified: true, aadhaarNumber: "123456789012" }`.
4. **Cross-Owner Impersonation**: `products/{id}` create with `ownerId: "victimUid"`.
5. **PII Snooping**: Non-owner `get` or `list` on `/users/{victimUid}/private/pii`.
6. **Unfiltered List Scraping**: `list` on `/bookings`, `/orders`, or `/transactions` without filtering by `customerId`/`ownerId`/`userId`.
7. **Admin Fee Tampering**: Non-admin write to `/platformConfig/default` or `/zones/{zoneId}`.
8. **AI Proposal Self-Approval**: Non-admin update to `/aiDecisions/{id}` setting `approvalStatus: "Approved"`.
9. **Transaction Verification Spoof**: Non-admin updating `/transactions/{id}` `status` to `"Verified"`.
10. **Terminal State Rollback**: Customer modifying a `"Completed"` booking back to `"Requested"`.
11. **Resource Poisoning**: Creating a document with 15KB string in `fullName` or invalid `docId` containing spaces/slashes.
12. **Client Timestamp Forgery**: Creating a booking with backdated `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
