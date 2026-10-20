export interface PasswordRequirements {
  length: boolean;
  uppercase: boolean;
  number: boolean;
  specialCharacter: boolean;
}

export type PasswordStrengthLevel = 'weak' | 'minimum' | 'medium' | 'strong' | 'excellent';

export interface PasswordStrength {
  percentage: number;
  label: string;
  level: PasswordStrengthLevel;
}

export function getPasswordRequirements(password: string): PasswordRequirements {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    specialCharacter: /[^A-Za-z0-9]/.test(password),
  };
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (password.length < 8) {
    return {
      percentage: 25,
      label: 'Débil',
      level: 'weak',
    };
  }

  const requirements = getPasswordRequirements(password);

  const improvements = [
    requirements.uppercase,
    requirements.number,
    requirements.specialCharacter,
  ].filter(Boolean).length;

  if (improvements === 0) {
    return {
      percentage: 50,
      label: 'Mínima',
      level: 'minimum',
    };
  }

  if (improvements === 1) {
    return {
      percentage: 75,
      label: 'Media',
      level: 'medium',
    };
  }

  if (improvements === 2) {
    return {
      percentage: 90,
      label: 'Fuerte',
      level: 'strong',
    };
  }

  return {
    percentage: 100,
    label: 'Excelente',
    level: 'excellent',
  };
}
