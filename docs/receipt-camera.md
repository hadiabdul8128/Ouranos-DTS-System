# Live receipt photos

On an editable Voucher, use **Receipts → Take a photo**. Allow camera access, hold the entire receipt in view, and choose **Scan receipt**. A laptop uses its webcam; mobile browsers prefer a rear camera when available. **Upload receipt** still accepts JPEG, PNG, and PDF files. Receipts can also be collected while plan approval is pending; preparing/submitting the Voucher still requires the approved Authorization.

Camera access requires HTTPS (or localhost). If an embedded browser cannot show the permission prompt, open Ouranos in a regular browser such as Chrome or Safari. No microphone access is requested. Closing the preview, pressing Escape, navigating away, or hiding the tab releases the camera. Late permission responses are also released after cancellation.

The photo is captured at the camera's frame resolution as a JPEG and passed to the existing `LocalRepository.captureReceipt` path. It retains the original image, associates it with the trip, stages an upload, and uses the configured receipt scanner/OCR worker. Camera capture does not introduce another extraction service or change reconciliation rules. Without a connection or a configured receipt processor, the normal saved/pending receipt states still apply.

OCR quality depends on focus, lighting, camera resolution, and receipt layout. Camera capture does not guarantee every field will extract correctly; travelers still check uncertain extracted details. Authorization approval and submitted-Voucher editing restrictions remain in effect.

Automated coverage: `platform/tests/receipt-camera.test.ts` checks frame dimensions/encoding, upload queue integration, camera lifecycle cancellation, and error handling. A physical webcam and browser permission grant are needed for a hardware capture test.
