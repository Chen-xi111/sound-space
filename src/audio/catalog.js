export const catalog = {
  "diagnostic-tone@1": {
    "id": "diagnostic-tone",
    "revision": 1,
    "category": "cue",
    "durationMs": 2000,
    "channels": 1,
    "licenseStatus": "verified",
    "licenseRef": "SELF-AUTHORED-DIAGNOSTIC",
    "resourceKey": "diagnostic-tone-v1",
    "contentHash": "72d41b01fc977c51a9ded3a7339be93cf1abe8505c1d58e613a9870d15e7a08a"
  }
};
export const resources = {"diagnostic-tone-v1": "/public/assets/diagnostic-tone.wav"};

// Natural recordings: author and license details in public/assets/SOURCE.md.
catalog["nature-rain@1"] = {
  "id": "nature-rain",
  "revision": 1,
  "durationMs": 30000,
  "channels": 1,
  "contentHash": "0ecf144994323e32e37bec7c22214118383c011410750b0305561f6bf0681597",
  "category": "nature",
  "licenseStatus": "verified",
  "licenseRef": "PD-EZWA-RAIN",
  "resourceKey": "nature-rain-v1"
};
resources["nature-rain-v1"] = "/public/assets/nature-rain-v1.wav";
catalog["nature-stream@1"] = {
  "id": "nature-stream",
  "revision": 1,
  "durationMs": 28000,
  "channels": 1,
  "contentHash": "7c3773fb6275940ee055656708428d9c6bd584a325b878f0f1dbf361c4a1dfc0",
  "category": "nature",
  "licenseStatus": "verified",
  "licenseRef": "CC0-KSD5-SWALE",
  "resourceKey": "nature-stream-v1"
};
resources["nature-stream-v1"] = "/public/assets/nature-stream-v1.wav";
catalog["nature-wind@1"] = {
  "id": "nature-wind",
  "revision": 1,
  "durationMs": 45000,
  "channels": 2,
  "contentHash": "054646063400357b411813e48d888b9c212d86cdd656dd72bf6d9e58d1fb52f5",
  "category": "nature",
  "licenseStatus": "verified",
  "licenseRef": "CC-BY-3.0-LUC-DE-BRUIJN-WIND",
  "resourceKey": "nature-wind-v1"
};
resources["nature-wind-v1"] = "/public/assets/nature-wind-v1.wav";

// Continuous carriers: derived recording licenses and processing in SOURCE.md.
catalog["carrier-soft-rain@1"] = {
  "id": "carrier-soft-rain",
  "revision": 1,
  "durationMs": 46800,
  "channels": 2,
  "contentHash": "fb367322d047685d6b0d146da4c2a16f9cd0303dbc249682918d03979264de80",
  "category": "nature",
  "licenseStatus": "verified",
  "licenseRef": "PD-EZWA-RAIN",
  "resourceKey": "carrier-soft-rain-v1"
};
resources["carrier-soft-rain-v1"] = "/public/assets/carrier-soft-rain-v1.wav";
catalog["carrier-water-veil@1"] = {
  "id": "carrier-water-veil",
  "revision": 1,
  "durationMs": 46800,
  "channels": 2,
  "contentHash": "80fef00d863096fdfe46dfed0302b54995537f8705bc3ad846143ba66e954c09",
  "category": "nature",
  "licenseStatus": "verified",
  "licenseRef": "CC0-KSD5-SWALE",
  "resourceKey": "carrier-water-veil-v1"
};
resources["carrier-water-veil-v1"] = "/public/assets/carrier-water-veil-v1.wav";
