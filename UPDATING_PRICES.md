# How to Update Animal Prices

To change the Base Value (Points) of animals, you must update **3 files** to ensure the scoring and the display match.

## 1. The Server Logic (CRITICAL)
This controls the actual scoring calculation.
*   **File:** `server/src/types.ts`
*   **Look for:** `export const ANIMALS = { ... }`
*   **Action:** Change the `baseValue` number for each animal.

```typescript
// Example in server/src/types.ts
export const ANIMALS: Record<AnimalType, Animal> = {
  cow: { type: "cow", gender: "female", baseValue: 20, displayName: "Cow" }, // Changed from 10 to 20
  // ...
};
```

## 2. The User Interface
This controls what players see on their dashboard.
*   **File:** `public/user.js`
*   **Look for:** `function getAnimalData(type)`
*   **Action:** Update the `baseValue` numbers to match the server.

```javascript
// Example in public/user.js
function getAnimalData(type) {
  const animals = {
    cow: { type: "cow", gender: "female", baseValue: 20, displayName: "Holstein Cow" },
    // ...
  };
  // ...
}
```

## 3. The Admin Interface
This controls what you see on the big screen.
*   **File:** `public/admin.js`
*   **Look for:** `function getAnimalDataFromType(type)`
*   **Action:** Update the `points` (or `baseValue`) numbers.

```javascript
// Example in public/admin.js
function getAnimalDataFromType(type) {
  const animalsMap = {
    cow: { name: "Holstein Cow", gender: "Female", points: 20 },
    // ...
  };
  // ...
}
```
## 4. The Admin Interface  (visuals)
Also you need to update admin.html for visual to match exactly what it is!

## FINAL STEP: Apply Changes
After saving all 3 files, you must rebuild the server for the changes to take effect:

1.  Open your terminal.
2.  Run: `npm run build`
3.  Run: `npm start`
