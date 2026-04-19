---
name: documentation-standards
description: "Guidelines and rules for Code Documentation (TSDoc/JSDoc), Technical Reports, and PDF generation standards."
---

# 📄 Documentation & Style Standards

This skill ensures that the Multicore system is well-documented, making it maintainable and professional. Documentation should be seen as part of the code, not an afterthought.

## 1. Self-Documenting Code
- **Intention-Revealing Names**: Priorities clear variable and function names over comments. If you need a comment to explain what a variable is, rename the variable.
- **Explain the "Why", not the "What"**: 
  - *Bad*: `// Increment i by 1`
  - *Good*: `// We increment this to account for the header row in the spreadsheet`
- **Avoid Commented-Out Code**: Never leave commented-out code in the repository. Use Git for version history.

## 2. Code Comments (TSDoc / JSDoc)
- **Public APIs & Services**: All public functions in the Service and Repository layers MUST have a TSDoc block.
- **Format**:
  ```typescript
  /**
   * Calculates the total price including dynamic tax rules.
   * 
   * @param items - List of products to be calculated
   * @param taxRate - The current tax rate (e.g., 0.17 for 17%)
   * @returns The total amount formatted as a currency string
   * @throws {TaxCalculationError} If the tax rate is invalid
   */
  async calculateTotal(items: CartItem[], taxRate: number): Promise<string> { ... }
  ```
- **Zod Schemas**: Always add a description to complex Zod fields using `.describe()`.

## 3. Technical Documents & Reports
- **Internal READMEs**: Every major module (Commercial, HR, Warehouse) should have a `README.md` explaining its purpose, core logic, and any special configurations.
- **Architectural Decision Records (ADR)**: For significant changes (e.g., changing the database provider or adding a new global caching strategy), document the rationale in a small markdown file.
- **PDF Document Generation**:
  - All generated documents (Invoices, Quotations, Reports) must maintain a professional brand identity.
  - Use consistent margins (20mm) and standard fonts (Helvetica/Arial).
  - Include a footer with page numbers and the "Multicore" system identifier.

## 4. Documentation Enforcement Checklist
1. [ ] Is the code readable enough that it explains itself without excessive comments?
2. [ ] Do all public service functions have proper TSDoc/JSDoc blocks?
3. [ ] Are complex business rules explained with "Why" comments?
4. [ ] Are there any blocks of commented-out code that should be removed?
5. [ ] Does the documentation for new features clearly explain how they integrate with the existing system?
