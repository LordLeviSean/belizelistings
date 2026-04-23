export function hasMinimumPasswordLength(password) {
  return password.length >= 6;
}

export function validateResetPassword(password, confirmPassword) {
  if (!hasMinimumPasswordLength(password)) {
    return "Password must be at least 6 characters";
  }

  if (password !== confirmPassword) {
    return "Passwords do not match";
  }

  return "";
}
