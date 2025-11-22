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

    try {
      const res = await axios.post('http://localhost:5000/api/auth/login', {
        email: formData.email,
        password: formData.password,
      });

      const { access_token } = res.data.data;

      // Store JWT (you can switch to cookies later)
      localStorage.setItem('access_token', access_token);

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
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
          Don’t have an account?{' '}
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
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  form: {
    width: '100%',
    maxWidth: '400px',
    padding: '30px',
    background: '#020617',
    borderRadius: '10px',
    boxShadow: '0 0 20px rgba(0,0,0,0.4)',
  },
  title: {
    textAlign: 'center',
    color: '#fff',
    marginBottom: '20px',
    fontSize: '24px',
  },
  input: {
    width: '100%',
    padding: '12px',
    marginBottom: '15px',
    borderRadius: '6px',
    border: '1px solid #1e293b',
    backgroundColor: '#020617',
    color: '#fff',
    outline: 'none',
  },
  button: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#22c55e',
    border: 'none',
    borderRadius: '6px',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  error: {
    color: '#ef4444',
    marginBottom: '10px',
    textAlign: 'center',
  },
  text: {
    color: '#cbd5f5',
    textAlign: 'center',
    marginTop: '15px',
  },
  link: {
    color: '#22c55e',
    cursor: 'pointer',
  },
};
