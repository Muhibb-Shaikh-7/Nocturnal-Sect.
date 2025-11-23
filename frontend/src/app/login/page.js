'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function LoginPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
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
    setLoading(true);
    setError('');

    // Since we've removed authentication, we'll just redirect to the dashboard
    // without actually authenticating
    try {
      // Simulate a successful login
      setTimeout(() => {
        router.push('/dashboard');
      }, 500);
    } catch (err) {
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <form style={styles.form} onSubmit={handleSubmit}>
        <h2 style={styles.title}>Login</h2>

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
          placeholder="Enter your password"
          required
          value={formData.password}
          onChange={handleChange}
          style={styles.input}
        />

        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? 'Logging in...' : 'Login'}
        </button>

        <p style={styles.text}>
          Don't have an account?{' '}
          <span
            style={styles.link}
            onClick={() => router.push('/register')}
          >
            Register
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
    backgroundColor: '#0d1117',
    padding: '20px',
  },
  form: {
    width: '100%',
    maxWidth: '400px',
    backgroundColor: '#161b22',
    padding: '30px',
    borderRadius: '12px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
    border: '1px solid #30363d',
  },
  title: {
    textAlign: 'center',
    color: '#58a6ff',
    marginBottom: '20px',
    fontSize: '28px',
  },
  error: {
    color: '#f85149',
    backgroundColor: 'rgba(248, 81, 73, 0.1)',
    padding: '10px',
    borderRadius: '8px',
    marginBottom: '15px',
    textAlign: 'center',
    border: '1px solid rgba(248, 81, 73, 0.4)',
  },
  input: {
    width: '100%',
    padding: '12px 15px',
    marginBottom: '15px',
    borderRadius: '8px',
    border: '1px solid #30363d',
    backgroundColor: '#0d1117',
    color: '#f0f6fc',
    fontSize: '16px',
    outline: 'none',
  },
  button: {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#238636',
    color: '#ffffff',
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
  },
  text: {
    marginTop: '15px',
    textAlign: 'center',
    color: '#8b949e',
  },
  link: {
    color: '#58a6ff',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
};