/** Mirrors the backend contact formats without changing the authentication API. */
export function loginContact(raw: string): {channel: 'email' | 'phone'; value: string} {
  const value = raw.trim();
  if (!value) throw new Error('請填寫電郵地址或手機號碼。');
  if (value.includes('@')) {
    if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new Error('電郵地址格式不正確。');
    }
    return {channel: 'email', value: value.toLowerCase()};
  }
  let phone = value.replace(/[ -]/g, '');
  if (/^[0-9]{8}$/.test(phone)) phone = `+852${phone}`;
  if (!/^\+[1-9][0-9]{7,14}$/.test(phone)) throw new Error('請填寫有效的電郵地址或手機號碼。');
  return {channel: 'phone', value: phone};
}

export function otpDigits(value: string): string {
  return value.replace(/[０-９]/g, char => String(char.charCodeAt(0) - 0xff10)).replace(/\D/g, '').slice(0, 6);
}

const commonPasswords = new Set([
  'password1234', '123456789012', 'qwertyuiop12', 'letmein123456',
  'admin12345678', 'diaguide1234', 'iloveyou12345', '111111111111',
]);

export function newPasswordError(password: string, confirmation: string): string {
  const length = Array.from(password.normalize('NFC')).length;
  if (length < 12 || length > 128 || !password.trim() || commonPasswords.has(password.toLocaleLowerCase('en'))) {
    return '密碼須為 12 至 128 個字元，並避免使用常見密碼。';
  }
  if (password !== confirmation) return '兩次輸入的密碼不一致。';
  return '';
}

export function registrationNameError(name: string): string {
  const length = Array.from(name.trim()).length;
  return length < 1 || length > 100 ? '請填寫不多於 100 個字元的姓名。' : '';
}

/** Spaces retain empty middle cells while the user corrects an individual digit. */
export function replaceOtpDigits(value: string, index: number, digits: string): string {
  const slots = value.padEnd(6, ' ').split('');
  if (!digits) slots[index] = ' ';
  else {
    const start = digits.length === 6 ? 0 : index;
    for (let offset = 0; offset < digits.length && start + offset < 6; offset++) {
      slots[start + offset] = digits[offset];
    }
  }
  return slots.join('').trimEnd();
}
