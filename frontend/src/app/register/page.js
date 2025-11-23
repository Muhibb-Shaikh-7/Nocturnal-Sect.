'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function RegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    // Since we've removed authentication, we'll just redirect to the login page
    // without actually registering
    try {
      // Simulate a successful registration
      setTimeout(() => {
        router.push('/login');
      }, 500);
    } catch (err) {
      setError('Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <form style={styles.form} onSubmit={handleSubmit}>
        <h2 style={styles.title}>Create Account</h2>

        {error && <p style={styles.error}>{error}</p>}

        <input
          type="email"
          name="email"
          placeholder="Enter your email"
          required
          value={formData.email}
          onChange={handleChange}
          style={styles.input}
        />

        <input
          type="password"
          name="password"
          placeholder="Create a password"
          required
          value={formData.password}
          onChange={handleChange}
          style={styles.input}
        />

        <input
          type="password"
          name="confirmPassword"
          placeholder="Confirm your password"
          required
          value={formData.confirmPassword}
          onChange={handleChange}
          style={styles.input}
        />

        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? 'Registering...' : 'Register'}
        </button>

        <p style={styles.text}>
          Already have an account?{' '}
          <span
            style={styles.link}
            onClick={() => router.push('/login')}
          >
            Login
          </span>
        </p>
      </form>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#020617',
    padding: '20px',
  },
  form: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: '#0f172a',
    padding: '32px',
    borderRadius: '16px',
    boxShadow: '0 30px 60px rgba(2, 6, 23, 0.35)',
    border: '1px solid rgba(99, 102, 241, 0.4)',
  },
  title: {
    textAlign: 'center',
    color: '#e0e7ff',
    marginBottom: '24px',
    fontSize: '28px',
    letterSpacing: '0.05em',
  },
  error: {
    color: '#fecaca',
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    padding: '12px',
    borderRadius: '10px',
    marginBottom: '16px',
    border: '1px solid rgba(248, 113, 113, 0.4)',
    textAlign: 'center',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    marginBottom: '16px',
    borderRadius: '10px',
    border: '1px solid rgba(148, 163, 184, 0.4)',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    color: '#f8fafc',
    fontSize: '15px',
    outline: 'none',
  },
  button: {
    width: '100%',
    padding: '14px',
    borderRadius: '10px',
    border: 'none',
    backgroundImage: 'linear-gradient(135deg, #7c3aed, #2563eb)',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s ease',
  },
  text: {
    marginTop: '18px',
    textAlign: 'center',
    color: '#cbd5f5',
  },
  link: {
    color: '#a5b4fc',
    cursor: 'pointer',
    textDecoration: 'underline',
    fontWeight: 600,
  },
};