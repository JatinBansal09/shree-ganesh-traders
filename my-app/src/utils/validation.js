// Username validation
export const validateUsername = (username) => {
  const usernameRegex = /^[a-zA-Z0-9_]{4,}$/;
  return usernameRegex.test(username);
};

// Password validation
export const validatePassword = (password) => {
  const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!#%*?&]{8,}$/;
  return passwordRegex.test(password);
};

// Phone validation
export const validatePhone = (phone) => {
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone);
};

// Name validation (only alphabets + spaces)
export const validateName = (name) => {
  const nameRegex = /^[A-Za-z\s]+$/;
  return nameRegex.test(name);
};

// Email validation
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};
