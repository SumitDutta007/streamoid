import { parseCsvSync, validateRow } from "../src/utils/parseCsv";

describe('CSV Parsing and Validation', () => {
  const sampleCsv = `sku,name,brand,color,size,mrp,price,quantity
TSHIRT-RED-001,Classic Cotton T-Shirt,StreamThreads,Red,M,799,499,20
JEANS-BLU-032,Slim Fit Jeans,DenimWorks,Blue,32,1999,1599,15
BAD-ROW,MissingPrice,NoBrand,Blue,L,599,,5`;

  describe('parseCsvSync', () => {
    test('should parse valid CSV and return records', () => {
      const records = parseCsvSync(sampleCsv);
      expect(records.length).toBe(3);
      expect(records[0].sku).toBe('TSHIRT-RED-001');
      expect(records[0].name).toBe('Classic Cotton T-Shirt');
      expect(records[0].brand).toBe('StreamThreads');
    });

    test('should handle CSV with empty lines', () => {
      const csvWithEmptyLines = `sku,name,brand,mrp,price

TSHIRT-001,Test,Brand,100,90

`;
      const records = parseCsvSync(csvWithEmptyLines);
      expect(records.length).toBe(1);
    });

    test('should trim whitespace from values', () => {
      const csvWithSpaces = `sku,name,brand,mrp,price
  TSHIRT-001 , Test Product , Brand Name , 100 , 90 `;
      const records = parseCsvSync(csvWithSpaces);
      expect(records[0].sku).toBe('TSHIRT-001');
      expect(records[0].name).toBe('Test Product');
    });
  });

  describe('validateRow - Valid Cases', () => {
    test('should accept valid product with all fields', () => {
      const row = {
        sku: 'TSHIRT-001',
        name: 'Test Product',
        brand: 'TestBrand',
        color: 'Red',
        size: 'M',
        mrp: '1000',
        price: '800',
        quantity: '10'
      };
      const result = validateRow(row);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.parsed.sku).toBe('TSHIRT-001');
      expect(result.parsed.mrp).toBe(1000);
      expect(result.parsed.price).toBe(800);
    });

    test('should accept product without optional fields (color, size)', () => {
      const row = {
        sku: 'TSHIRT-001',
        name: 'Test Product',
        brand: 'TestBrand',
        mrp: '1000',
        price: '800',
        quantity: '10'
      };
      const result = validateRow(row);
      expect(result.valid).toBe(true);
      expect(result.parsed.color).toBeNull();
      expect(result.parsed.size).toBeNull();
    });

    test('should accept when price equals mrp', () => {
      const row = {
        sku: 'TSHIRT-001',
        name: 'Test',
        brand: 'Brand',
        mrp: '1000',
        price: '1000',
        quantity: '5'
      };
      const result = validateRow(row);
      expect(result.valid).toBe(true);
    });

    test('should accept zero quantity', () => {
      const row = {
        sku: 'TSHIRT-001',
        name: 'Test',
        brand: 'Brand',
        mrp: '1000',
        price: '800',
        quantity: '0'
      };
      const result = validateRow(row);
      expect(result.valid).toBe(true);
      expect(result.parsed.quantity).toBe(0);
    });
  });

  describe('validateRow - Invalid Cases', () => {
    test('should reject when required field is missing', () => {
      const missingFields = ['sku', 'name', 'brand', 'mrp', 'price'];
      
      missingFields.forEach(field => {
        const row: any = {
          sku: 'TEST-001',
          name: 'Test',
          brand: 'Brand',
          mrp: '1000',
          price: '800'
        };
        delete row[field];
        
        const result = validateRow(row);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('required'))).toBe(true);
      });
    });

    test('should reject when required field is empty string', () => {
      const row = {
        sku: '',
        name: 'Test',
        brand: 'Brand',
        mrp: '1000',
        price: '800',
        quantity: '5'
      };
      const result = validateRow(row);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('sku is required');
    });

    test('should reject when price > mrp', () => {
      const row = {
        sku: 'TSHIRT-001',
        name: 'Test',
        brand: 'Brand',
        mrp: '800',
        price: '1000',
        quantity: '5'
      };
      const result = validateRow(row);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('price must be <= mrp');
    });

    test('should reject when quantity is negative', () => {
      const row = {
        sku: 'TSHIRT-001',
        name: 'Test',
        brand: 'Brand',
        mrp: '1000',
        price: '800',
        quantity: '-5'
      };
      const result = validateRow(row);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('quantity must be >= 0');
    });

    test('should reject when mrp is not a number', () => {
      const row = {
        sku: 'TSHIRT-001',
        name: 'Test',
        brand: 'Brand',
        mrp: 'invalid',
        price: '800',
        quantity: '5'
      };
      const result = validateRow(row);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('mrp must be a number');
    });

    test('should reject when price is not a number', () => {
      const row = {
        sku: 'TSHIRT-001',
        name: 'Test',
        brand: 'Brand',
        mrp: '1000',
        price: 'abc',
        quantity: '5'
      };
      const result = validateRow(row);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('price must be a number');
    });

    test('should collect multiple validation errors', () => {
      const row = {
        sku: '',
        name: '',
        brand: 'Brand',
        mrp: 'invalid',
        price: '1500',
        quantity: '-10'
      };
      const result = validateRow(row);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(2);
    });
  });

  describe('validateRow - Edge Cases', () => {
    test('should handle missing quantity field (defaults to 0)', () => {
      const row = {
        sku: 'TSHIRT-001',
        name: 'Test',
        brand: 'Brand',
        mrp: '1000',
        price: '800'
      };
      const result = validateRow(row);
      expect(result.valid).toBe(true);
      expect(result.parsed.quantity).toBe(0);
    });

    test('should handle very large numbers', () => {
      const row = {
        sku: 'TSHIRT-001',
        name: 'Test',
        brand: 'Brand',
        mrp: '999999',
        price: '999998',
        quantity: '999999'
      };
      const result = validateRow(row);
      expect(result.valid).toBe(true);
      expect(result.parsed.mrp).toBe(999999);
    });
  });
});
