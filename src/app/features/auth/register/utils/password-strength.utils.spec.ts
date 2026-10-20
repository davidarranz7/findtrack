import { getPasswordRequirements, getPasswordStrength } from './password-strength.utils';

describe('Password strength utilities', () => {
  describe('getPasswordRequirements', () => {
    it('should detect a password with every requirement', () => {
      expect(getPasswordRequirements('Abcdefg1!')).toEqual({
        length: true,
        uppercase: true,
        number: true,
        specialCharacter: true,
      });
    });

    it('should detect missing recommendations', () => {
      expect(getPasswordRequirements('abcdefgh')).toEqual({
        length: true,
        uppercase: false,
        number: false,
        specialCharacter: false,
      });
    });

    it('should require at least eight characters', () => {
      expect(getPasswordRequirements('Abc1!').length).toBe(false);
      expect(getPasswordRequirements('abcdefgh').length).toBe(true);
    });
  });

  describe('getPasswordStrength', () => {
    it('should classify passwords shorter than eight characters as weak', () => {
      expect(getPasswordStrength('A1!')).toEqual({
        percentage: 25,
        label: 'Débil',
        level: 'weak',
      });
    });

    it('should classify passwords with only the mandatory length as minimum', () => {
      expect(getPasswordStrength('abcdefgh')).toEqual({
        percentage: 50,
        label: 'Mínima',
        level: 'minimum',
      });
    });

    it('should classify passwords with one recommendation as medium', () => {
      expect(getPasswordStrength('Abcdefgh')).toEqual({
        percentage: 75,
        label: 'Media',
        level: 'medium',
      });
    });

    it('should classify passwords with two recommendations as strong', () => {
      expect(getPasswordStrength('Abcdefg1')).toEqual({
        percentage: 90,
        label: 'Fuerte',
        level: 'strong',
      });
    });

    it('should classify passwords with all recommendations as excellent', () => {
      expect(getPasswordStrength('Abcdefg1!')).toEqual({
        percentage: 100,
        label: 'Excelente',
        level: 'excellent',
      });
    });

    it('should keep recommendations optional', () => {
      const requirements = getPasswordRequirements('abcdefgh');

      expect(requirements.length).toBe(true);
      expect(requirements.uppercase).toBe(false);
      expect(requirements.number).toBe(false);
      expect(requirements.specialCharacter).toBe(false);
    });
  });
});
