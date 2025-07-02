Architectural Design Document
Project Name
One-Time KYC with Reusable Verifiable Attestations (v2)
Overview
This document presents the rearchitected design for a privacy-preserving, user-controlled
identity verification system that enables users to complete Know Your Customer (KYC) once
and reuse verified attestations across multiple platforms. The system addresses the flaws of the
original architecture by reducing third-party dependencies, improving user experience, ensuring
regulatory compliance, and enhancing scalability and security. Key technologies include:
●
●
●
●
●
●
●
SDK-driven architecture to abstract Web3 complexities
Multi-provider KYC adapter for flexibility
Decentralized storage (Filecoin, Arweave) for encrypted KYC data
Ethereum Attestation Service (EAS) for tamper-proof attestations
Zero-knowledge proofs (ZKPs) for selective disclosure
Passkey-based authentication as a fallback to Privy
Lit Protocol for advanced access control
Goals
●
●
●
●
●
●
●
Enable users to complete KYC once and reuse it across platforms
Ensure users retain full control over their identity data
Prevent any centralized entity (including the provider) from accessing PII
Support selective disclosure of KYC attributes (e.g.,
"over 18" without revealing
birthdate)
Ensure compliance with global KYC/AML regulations
Minimize dependencies and enhance scalability
Provide a seamless user experience for non-technical users
Architecture Overview
🔹 Actors
●
●
●
●
●
●
●
●
User: Individual completing KYC and controlling data access
Platform A/B: Services integrating the system via SDK or REST API
KYC Providers: Multiple providers (e.g., Smile Identity, Onfido, Trulioo) for verification
Identity Service Backend: Facilitates KYC flows and attestation creation without storing
PII
EAS: Stores off-chain attestations of KYC status
Decentralized Storage: Stores encrypted KYC data (Filecoin, Arweave)
Lit Protocol: Manages access control for encrypted data
Passkey Provider: Alternative authentication mechanism (e.g., WebAuthn)
Component Breakdown
1. Authentication Layer
●
●
●
●
Primary: Privy for account abstraction, enabling email/phone/social login and creating a
smart contract wallet for cryptographic operations (e.g., signing, encryption).
Fallback: Passkey-based authentication (WebAuthn) for users or platforms preferring
non-custodial, device-bound credentials.
Purpose: Simplifies Web3 interactions, supports non-technical users, and reduces
dependency on a single provider (Privy).
Implementation:
○
Privy creates a wallet tied to user identity (email, phone, or social).
○
Passkeys use public-key cryptography, stored securely on the user’s device.
○
Both methods support signing for encryption/decryption and attestation approval.
2. KYC Verification Module
●
Modular KYC Adapter:
1. Supports multiple KYC providers (Smile Identity, Onfido, Trulioo) via a
plugin-based architecture.
2. Dynamically selects the provider based on platform preferences, user region, or
availability.
Fallback to alternative providers in case of outages.
●
3. Flow:
1. 2. 3. 4. User initiates KYC via Platform A’s frontend (using SDK).
SDK sends request to the Identity Service Backend, specifying the preferred
provider.
Backend routes the request to the chosen provider, passing user-provided data
(e.g., ID document, selfie).
Provider returns result: PASS/FAIL + metadata (e.g., name, BVN, DOB).
●
Privacy Note: The backend discards PII immediately after processing; only encrypted
data and attestations persist.
3. Client-Side Encryption and Storage
●
●
●
Encryption:
○
KYC data is encrypted on the client side using AES-256-GCM.
○
The AES key is encrypted with the user’s Privy wallet or Passkey public key.
○
Selective disclosure supported via ZKPs (e.g., proving age > 18 without revealing
DOB).
Storage:
○
Encrypted KYC payloads are stored on decentralized networks (Filecoin for
redundancy, Arweave for permanence).
○
Lit Protocol enforces access control, ensuring only authorized parties (approved
by the user) can retrieve and decrypt data.
Implementation:
○
SDK handles encryption and upload to Filecoin/Arweave.
○
Lit Protocol generates access control conditions (e.g., user signature, time-based
access).
○
Data hash is computed for integrity verification and included in EAS attestations.
4. Ethereum Attestation Service (EAS)
●
Purpose: Creates tamper-proof, off-chain attestations to prove KYC status.
Schema:
{
"schema": "kyc-v2"
,
"recipient": "0xUserWalletOrPasskeyHash"
,
"data": {
"provider": "SmileIdentity"
,
"country": "NG"
,
"kyc
_passed": true,
"data
_
hash": "0xEncryptedBlobHash"
,
"selective
_
attributes": ["age
over
18"
,
_
_
"timestamp": 1234567890
},
"signature": "attester
_
signature"
"country_
verified"],
}
●
●
Implementation:
○
○
Backend generates attestation after KYC verification.
Attestation stored via EAS SDK, referencing the encrypted data hash.
○
Supports ZKP-based selective disclosures (e.g., proving specific attributes
without revealing full data).
5. SDK and API Layer
●
SDK:
○
○
●
●
Abstracts REST API calls, encryption, and user consent flows.
Handles Privy/Passkey authentication, data encryption/decryption, and
attestation queries.
○
Provides UI components for user consent (e.g., approve/deny data access).
REST API (for legacy integrations):
○
POST /initiate-kyc: Starts KYC with specified provider; returns session ID.
○
GET /kyc-status/:userId: Retrieves attestation details (schema, hash,
timestamp).
○
GET /encrypted-payload/:userId: Returns storage URL and hash for
SDK decryption.
○
POST /verify-attestation: Validates attestation signature and schema.
○
POST /request-access: Triggers user consent flow via SDK.
Implementation:
○
SDK built with TypeScript, compatible with React, Node.js, and vanilla JS.
○
API uses JWT for authentication, rate-limited for security.
6. Cross-Platform Reuse
●
●
Flow:
1. 2. 3. 4. 5. Platform B queries EAS for user’s KYC attestation via SDK/API.
SDK retrieves encrypted payload URL and hash from Filecoin/Arweave.
User is prompted to approve access (via Privy/Passkey signature).
Lit Protocol enforces access conditions; Platform B decrypts authorized data.
ZKPs allow selective disclosure (e.g., Platform B verifies age without accessing
full KYC data).
Privacy Note: No PII is exposed to the backend or unauthorized platforms.
7. User Dashboard
●
●
●
Purpose: Allows users to manage attestations, view access history, and configure
data-sharing policies.
Features:
○
View active attestations and linked platforms.
○
Revoke access or set expiration for data sharing.
○
Pre-approve trusted platforms for seamless UX.
Implementation: Built as a React-based web app, integrated with the SDK, using
Tailwind CSS for styling.
Data Flow Diagram
User → Platform A (SDK) → Identity Service Backend → KYC Provider
↓ ↓
Encrypt KYC KYC Result
↓
Upload to Filecoin/Arweave (via Lit Protocol)
↓
Create EAS Attestation
↓
Platform B (SDK) → EAS → Check Attestation
↓
Request Access → Lit Protocol → User Approves (Privy/Passkey)
↓
Decrypt Data (or ZKP Verification) → Share Authorized Attributes
Security & Privacy Considerations
●
●
●
●
●
●
●
●
✅ No PII Storage: Backend discards PII after processing; only encrypted data persists.
✅ Client-Side Encryption: AES-256-GCM ensures data is secure on the user’s device.
✅ Lit Protocol: Enforces granular access control (e.g., time-based, signature-based).
✅ ZKP Support: Enables selective disclosure, minimizing data exposure.
✅ EAS Attestations: Tamper-proof, signed, and verifiable.
✅ Passkey Fallback: Reduces Privy dependency, enhances resilience.
✅ Secure Key Management: SDK uses secure enclaves or hardware-backed keys for
encryption.
❌ Risks Mitigated:
○
Device compromise: Use secure enclaves and MFA for sensitive operations.
○
Storage failures: Filecoin/Arweave provide redundancy and permanence.
○
Provider outages: Multi-provider adapter ensures fallback options.
Sample Implementation: SDK for KYC Initiation
Below is a sample TypeScript implementation of the SDK’s KYC initiation function,
demonstrating integration with Privy, KYC providers, and Filecoin.
import { PrivyClient } from '@privy-io/client'; import { LitProtocol } from '@lit-protocol/sdk'; import
{ FilecoinClient } from '@filecoin/client'; import { EAS } from
'@ethereum-attestation-service/eas-sdk'; import { encryptData, generateZKP } from
'
./crypto-utils'; import { KYCProviderAdapter } from '
./kyc-provider-adapter';
export class KYCSdk {
private privy: PrivyClient;
private lit: LitProtocol;
private filecoin: FilecoinClient;
private eas: EAS;
private kycAdapter: KYCProviderAdapter;
constructor(config: { privyKey: string; litConfig: any; filecoinConfig: any; easConfig: any }) {
this.privy = new PrivyClient(config.privyKey);
this.lit = new LitProtocol(config.litConfig);
this.filecoin = new FilecoinClient(config.filecoinConfig);
this.eas = new EAS(config.easConfig);
this.kycAdapter = new KYCProviderAdapter();
}
async initiateKYC(userData: { idDocument: File; selfie: File; country: string }, provider: string) {
try {
// Authenticate user
const user = await this.privy.authenticate();
const walletAddress = user.walletAddress;
// Initiate KYC with provider
const kycResult = await this.kycAdapter.verify(provider, userData);
if (!kycResult.passed) throw new Error('KYC verification failed');
// Encrypt KYC data
const { encryptedData, encryptedKey } = await encryptData(kycResult.metadata,
walletAddress);
// Upload to Filecoin
const cid = await this.filecoin.upload(encryptedData);
await this.lit.setAccessControl({
resource: cid,
conditions: [{ wallet: walletAddress, action: 'decrypt' }],
});
// Create EAS attestation
const attestation = {
schema: 'kyc-v2'
,
recipient: walletAddress,
data: {
provider,
country: userData.country,
kyc
_passed: true,
data
hash: cid,
_
selective
_
attributes: await generateZKP(kycResult.metadata, ['age
over
_
_
18']),
},
};
const attestationId = await this.eas.createOffchainAttestation(attestation);
return { attestationId, cid };
} catch (error) {
throw new Error(`KYC initiation failed: ${error.message}`);
}
}
}
BASIC FLOW
┌────────────────────┐
│ Your Frontend │
└────────┬───────────┘
│
Login (email/phone)│
▼
┌──────────────────┐
│ Privy AA Wallet │ ← smart contract wallet (no UX friction)
└──────────────────┘
│
KYC flow ▼
┌───────────────────────┐
│ KYC Provider (API) │ ← e.g., Smile Identity
└───────────────────────┘
│
KYC data (locally handled)
▼
┌────────────────────────────────────┐
│ Encrypt data client-side (in SDK) │ ← using Privy AA wallet keys
└────────────────────────────────────┘
│
Store encrypted data blob (IPFS/S3)
▼
┌────────────────────────────────────┐
│ Create **offchain** EAS attestation │ ← with your backend’s attester key
└────────────────────────────────────┘
│
SDK returns attestation reference
▼
User can now share access with other apps