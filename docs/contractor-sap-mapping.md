# Contractor SAP mappings

SAP assignments are saved against the contractor's stable ID, separately from shared material defaults. Two contractors can therefore use different SAP codes for the same Activity or Pole Schedule material.

- Selecting a contractor restores that contractor's saved assignments. The application does not guess a replacement from issued stock.
- A contractor without a saved assignment starts with the common defaults. The user maps any alternative issued SAP code manually.
- Mapping changes affect SAP fields and component factors. They do not replace row descriptions, rates, locations or entered measurement quantities.
- Explicit blank mappings and N/A are retained.
- Fixed manual reconciliation quantities are bill data and are not copied into reusable contractor profiles.
- Existing bill assignments are retained when first migrating a bill to contractor profiles.

`contractorMappingState` travels in the local/cloud bill snapshot and contains a common baseline plus sparse per-contractor overrides. Row identity uses the schedule key, material number, description and occurrence so filtering or sorting does not change the mapping target.

`GET /api/contractor-mapping?contractorId=...` and `POST /api/contractor-mapping` provide reusable profiles across bills/devices. The existing API-key policy applies. Profiles are saved as separate DefaultConfig records; they never bulk-update bills. Complete override maps are serialized so Firestore merge writes cannot revive removed overrides.

Pending local edits win over delayed profile responses. Requests for a contractor that is no longer selected are ignored. Offline edits remain in the bill/local cache and can be saved to cloud when online. Shared SAP catalogue entries continue to be stored separately from contractor assignments.

Run `npm test` for contractor isolation, all schedules, quantities, clearing/N/A, actual local reload, profile reuse, Undo, delayed responses and API isolation checks.
