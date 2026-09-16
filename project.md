# 🛒 TrustCart — Private Proof of Authentic Products

## 1. What is TrustCart?

**TrustCart** is a privacy-first product verification platform.

It helps a customer verify that a product is:

* Genuine or counterfeit
* Sold by an authorized seller
* Covered by a valid warranty
* Previously owned or transferred legitimately
* Associated with a real purchase

The important part is that users **do not need to reveal all their private purchase information**.

For example, a customer could prove:

> “This phone is genuine and has a valid warranty”

without revealing:

* Their name
* Exact purchase price
* Home address
* Complete invoice
* Phone number
* Other products they bought

This is where **Midnight’s privacy and selective-disclosure features** become useful.

---

# 2. Example: How a customer would use TrustCart

Imagine someone buys an expensive smartphone.

### Step 1: Manufacturer registers the product

The manufacturer creates a digital product record containing:

* Product ID
* Model
* Serial number or product hash
* Manufacturing batch
* Warranty duration
* Authorized seller information

Instead of putting all this private information publicly on-chain, TrustCart stores a **cryptographic commitment or hash** on Midnight.

Example:

```text
Product ID: PHONE-83921
Model: ExamplePhone X
Serial Number: SN-123456
Warranty: 24 months
```

The system creates a commitment:

```text
ProductCommitment = Hash(product details + secret)
```

Only the necessary proof or public commitment is recorded on-chain.

---

### Step 2: Authorized seller sells the product

The seller creates a purchase record:

```text
Product ID: PHONE-83921
Seller: Authorized Seller A
Buyer: Customer
Purchase Date: 10 September 2026
Warranty: Valid
```

The buyer receives a QR code or digital product passport.

The QR code can contain:

```text
trustcart.app/product/PHONE-83921
```

It should not expose the customer's personal information.

---

### Step 3: Customer verifies the product

The customer scans the QR code.

TrustCart checks whether:

* The product was registered by the manufacturer
* The seller is authorized
* The product has not been reported stolen
* The product has not been duplicated
* The warranty is still valid
* The ownership record is consistent

The application then displays something like:

```text
✓ Product registered
✓ Seller authorized
✓ Warranty valid until 10 September 2028
✓ Ownership proof verified
✓ No public personal information revealed
```

---

### Step 4: Customer resells the product

Suppose the customer sells the phone to another person.

The customer can transfer ownership through TrustCart.

The new owner receives a new ownership credential, while the previous owner's personal information remains private.

The blockchain records something like:

```text
Ownership transferred:
Old Owner Credential → New Owner Credential
```

It does not need to publicly reveal the identities of either person.

---

# 3. Main features

## A. Product registration

Manufacturers or authorized brands can register products.

Possible fields:

* Product model
* Product serial number
* Product category
* Manufacturing batch
* Warranty period
* Manufacturer identity
* Product status

The actual sensitive data should be stored off-chain or encrypted. Midnight should store only commitments, proofs, and status information.

---

## B. Product authenticity verification

A customer can verify whether a product is genuine.

The system can prove:

* The product was registered by the manufacturer
* The serial number matches the registered commitment
* The product has not been registered twice
* The product has not been revoked
* The product belongs to a valid product batch

The customer receives a simple result:

```text
Authentic: Yes
Manufacturer: Verified
Product Status: Active
```

---

## C. Private warranty verification

A customer may want to prove that a product is under warranty without showing the full invoice.

For example, TrustCart can prove:

```text
Warranty is valid
```

without revealing:

```text
Purchase price
Customer name
Billing address
Payment method
Full invoice
```

The application could also support:

* Warranty start date
* Warranty expiry date
* Warranty extension
* Warranty transfer
* Warranty cancellation

---

## D. Authorized seller verification

TrustCart can maintain a list of approved sellers.

A seller could prove:

> “I am authorized to sell this brand.”

The customer does not have to trust an unknown seller based only on a website or screenshot.

Seller information may include:

* Seller credential
* Brand authorization
* Seller status
* Business category
* Authorization expiry
* Revocation status

---

## E. Ownership transfer

This is one of the strongest features for the project.

When a product is resold:

1. Current owner initiates transfer.
2. Buyer accepts the transfer.
3. TrustCart verifies both parties' credentials.
4. The product's ownership state is updated.
5. The buyer receives a new private ownership proof.

The system should avoid publicly publishing:

```text
Alice sold her phone to Bob
```

Instead, it records a privacy-preserving ownership transition.

---

## F. Stolen or revoked product status

A manufacturer or authorized authority can mark a product as:

* Stolen
* Lost
* Recalled
* Counterfeit
* Warranty cancelled
* Ownership disputed

A customer can check the product status without seeing private investigation details.

Example:

```text
Product status: Revoked
Reason available only to authorized parties
```

This feature needs careful governance because unauthorized parties should not be able to falsely revoke products.

---

## G. Private proof of purchase

The user can prove:

> “I purchased this product from an authorized seller.”

But they do not need to reveal:

* Exact price
* Payment details
* Full invoice
* Personal address
* Other items in the invoice

This can be useful for:

* Warranty claims
* Insurance
* Resale
* Refund eligibility
* Product registration

---

## H. Digital product passport

Each product can have a digital passport.

The passport could show:

* Product authenticity
* Manufacturer
* Product category
* Warranty status
* Ownership status
* Repair history, if available
* Recall status
* Sustainability information, if supplied by the manufacturer

The passport should display only information that the viewer is authorized to see.

---

## I. Selective disclosure

Different users can see different information.

### Public buyer

Can see:

```text
Product is genuine
Seller is authorized
Warranty is active
```

### Authorized service center

Can see:

```text
Warranty details
Repair eligibility
Product model
```

### Current owner

Can see:

```text
Ownership proof
Purchase proof
Warranty documents
Transfer history
```

### Manufacturer

Can see:

```text
Product registration
Manufacturing information
Revocation records
```

The idea is not to make everything public. It is to prove only what is necessary.

---

# 4. How Midnight fits into TrustCart

Midnight should be used for the parts that require:

* Privacy
* Verification
* Tamper resistance
* Shared trust
* Selective disclosure
* Ownership state management

A normal web application can handle the user interface, database, QR codes, and file uploads. Midnight should handle the important verification logic.

## Suggested division

```text
Frontend
  |
  | React / Next.js
  |
Backend API
  |
  | Product metadata
  | Encrypted invoices
  | User accounts
  | QR-code generation
  |
Midnight SDK
  |
Compact Smart Contracts
  |
Midnight Network
```

---

# 5. Suggested system architecture

```text
                         ┌─────────────────────────┐
                         │       TrustCart UI      │
                         │   React / Next.js App    │
                         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │       Backend API       │
                         │      Node.js / NestJS   │
                         └───────┬─────────┬───────┘
                                 │         │
                ┌────────────────┘         └────────────────┐
                ▼                                           ▼
┌────────────────────────────┐              ┌────────────────────────────┐
│ Encrypted Off-chain Store  │              │      Midnight SDK           │
│                            │              │                              │
│ - Product metadata         │              │ - Wallet connection         │
│ - Encrypted invoices       │              │ - Proof generation          │
│ - Product images           │              │ - Contract interaction      │
│ - Documents                │              │ - Transaction submission    │
└────────────────────────────┘              └──────────────┬─────────────┘
                                                            │
                                                            ▼
                                           ┌────────────────────────────┐
                                           │     Compact Contracts       │
                                           │                            │
                                           │ - Product registry         │
                                           │ - Seller authorization      │
                                           │ - Warranty verification     │
                                           │ - Ownership transfer       │
                                           │ - Product revocation       │
                                           │ - Proof validation          │
                                           └──────────────┬─────────────┘
                                                          │
                                                          ▼
                                           ┌────────────────────────────┐
                                           │       Midnight Network      │
                                           │                            │
                                           │ - Private state             │
                                           │ - Public commitments        │
                                           │ - Contract state             │
                                           │ - Verifiable transactions   │
                                           └────────────────────────────┘
```

---

# 6. Smart-contract architecture

For an MVP, divide the Compact logic into separate modules.

## Contract 1: ProductRegistry

Responsible for registering products.

### Possible state

```text
productCommitment
manufacturerCredential
productStatus
registrationTimestamp
```

### Functions

```text
registerProduct()
verifyProduct()
revokeProduct()
getProductStatus()
```

The contract should prevent duplicate registration of the same product commitment.

---

## Contract 2: SellerRegistry

Responsible for seller authorization.

### Possible state

```text
sellerCredential
brandCredential
authorizationStatus
authorizationExpiry
```

### Functions

```text
registerSeller()
authorizeSeller()
revokeSellerAuthorization()
verifySeller()
```

Only an authorized manufacturer or administrator should be allowed to authorize sellers.

---

## Contract 3: WarrantyRegistry

Responsible for warranty status.

### Possible state

```text
productCommitment
warrantyCommitment
warrantyExpiry
warrantyStatus
```

### Functions

```text
createWarranty()
verifyWarranty()
extendWarranty()
transferWarranty()
cancelWarranty()
```

A customer should be able to prove warranty validity without exposing the entire invoice.

---

## Contract 4: OwnershipRegistry

Responsible for product ownership.

### Possible state

```text
productCommitment
currentOwnerCommitment
ownershipVersion
transferStatus
```

### Functions

```text
issueOwnershipCredential()
initiateTransfer()
acceptTransfer()
verifyOwnership()
revokeOwnershipCredential()
```

The system should use commitments or private credentials instead of storing personal names publicly.

---

## Contract 5: RevocationRegistry

Responsible for product status changes.

### Possible state

```text
productCommitment
revocationStatus
revocationReasonCommitment
revokedByCredential
```

### Functions

```text
revokeProduct()
checkRevocation()
restoreProductStatus()
```

For the MVP, you can keep revocation authority limited to a trusted manufacturer account.

---

# 7. Example end-to-end workflow

```text
Manufacturer
     |
     | 1. Register product
     ▼
ProductRegistry
     |
     | 2. Create product commitment
     ▼
Midnight Network
     |
     | 3. Authorize seller
     ▼
SellerRegistry
     |
     | 4. Sell product and issue warranty
     ▼
WarrantyRegistry
     |
     | 5. Give QR code to customer
     ▼
Customer
     |
     | 6. Scan QR code
     ▼
TrustCart Backend
     |
     | 7. Generate verification request
     ▼
Midnight SDK
     |
     | 8. Prove product authenticity/warranty
     ▼
Compact Contracts
     |
     | 9. Return verification result
     ▼
Customer sees:
✓ Authentic
✓ Authorized seller
✓ Warranty valid
✓ Private details protected
```

---

# 8. What should be stored on-chain and off-chain?

## On Midnight

Store only information needed for verification:

* Product commitments
* Seller authorization commitments
* Warranty status
* Ownership commitments
* Revocation status
* Proof-related state
* Timestamps or status versions

## Off-chain

Store sensitive or large information:

* Full invoices
* Product images
* Customer names
* Addresses
* Detailed purchase records
* Repair documents
* Encrypted warranty documents

A good rule is:

> **Put proofs and commitments on Midnight, not private documents.**

---

# 9. Example privacy flow

Suppose an insurance company asks:

> “Can you prove that this product is genuine and was purchased from an authorized seller?”

The customer does not upload their complete invoice.

Instead:

1. The customer selects the product in TrustCart.
2. TrustCart reads the private purchase credential.
3. The Midnight SDK creates a proof.
4. The proof demonstrates:

   * The product commitment is registered.
   * The seller was authorized.
   * The purchase record exists.
   * The product belongs to the customer.
5. The insurance company verifies the proof.
6. The insurance company receives only the required result.

```text
Private data:
Customer name
Purchase price
Address
Invoice details
       |
       | used privately to create proof
       ▼
Selective-disclosure proof
       |
       ▼
Insurance company:
"Purchase and authenticity verified"
```

---

# 10. Recommended MVP for the hackathon

Do not try to build every feature initially. Build a focused demonstration.

## MVP features

### Manufacturer dashboard

* Register a product
* Generate product QR code
* View product status

### Seller dashboard

* Verify manufacturer authorization
* Register a sale
* Issue warranty credential

### Customer dashboard

* Scan or enter product ID
* Verify authenticity
* Verify seller
* Verify warranty
* View private digital product passport

### Ownership transfer

* Current owner starts transfer
* Buyer accepts transfer
* Ownership status changes privately

### Privacy demonstration

Show two screens:

#### Public verification

```text
Authentic: Yes
Warranty: Valid
Seller: Authorized
```

#### Hidden information

```text
Customer name: Hidden
Purchase price: Hidden
Address: Hidden
Full invoice: Hidden
```

This makes the Midnight value easy for judges to understand.

---

# 11. Suggested technology stack

```text
Frontend:
React / Next.js
Tailwind CSS
QR scanner library

Backend:
Node.js
TypeScript
Express or NestJS

Blockchain:
Midnight Network
Compact smart contracts
Midnight TypeScript SDK

Storage:
PostgreSQL for application metadata
Encrypted object storage for invoices
IPFS only for non-sensitive public assets, if needed

Authentication:
Wallet-based login
Manufacturer, seller, and customer credentials

Development:
Docker
GitHub
Automated tests
Testnet deployment
```

The exact Midnight SDK APIs and Compact syntax should be checked against the current official Midnight documentation before implementation, because the developer tooling may change between waves.

---

# 12. What makes this idea useful?

TrustCart solves a real problem in:

* Luxury goods
* Electronics
* Watches
* Pharmaceuticals
* Vehicle parts
* Collectibles
* Warranty management
* Second-hand marketplaces

For example, on a second-hand marketplace, a buyer could verify:

```text
✓ Product is genuine
✓ Product was originally registered
✓ Seller has ownership proof
✓ Warranty is still valid
✓ Product is not revoked
```

without requiring the seller to expose their entire purchase history.

## Strong hackathon pitch

> **TrustCart lets people prove that a product is genuine, legally owned, and covered by warranty—without exposing their private purchase information.**

That sentence clearly explains both the product value and the reason to use Midnight.
