import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';

const ForgotPassword = () => {
  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await api.post('/users/forgot-password/', { employee_id: employeeId, email });
      setSuccess(response.data.message);
    } catch (err) {
      const data = err.response?.data;
      if (data?.employee_id) setError(data.employee_id[0]);
      else if (data?.email) setError(data.email[0]);
      else setError(data?.message || 'Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Forgot Password</h2>

        {!success && (
          <p style={styles.description}>
            Enter your Employee ID and registered email address. We'll send you a link to reset your password.
          </p>
        )}

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        {!success && (
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Employee ID</label>
              <input
                type="text"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
                style={styles.input}
                disabled={loading}
                autoFocus
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={styles.input}
                disabled={loading}
              />
            </div>

            <button type="submit" style={{ ...styles.button, opacity: loading ? 0.6 : 1 }} disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: 20 }}>
          <Link to="/login" style={{ color: '#667eea', textDecoration: 'none', fontSize: '0.9rem' }}>
            Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: 20,
  },
  card: {
    background: 'white',
    padding: '40px',
    borderRadius: '10px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
    width: '100%',
    maxWidth: '400px',
  },
  title: {
    textAlign: 'center',
    color: '#333',
    marginBottom: 10,
  },
  description: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 30,
    fontSize: '14px',
  },
  error: {
    background: '#fee',
    color: '#c33',
    padding: '10px',
    borderRadius: '5px',
    marginBottom: 20,
    border: '1px solid #fcc',
  },
  success: {
    background: '#d4edda',
    color: '#155724',
    padding: '12px',
    borderRadius: '5px',
    marginBottom: 20,
    border: '1px solid #c3e6cb',
    textAlign: 'center',
    fontSize: '0.9rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    display: 'block',
    marginBottom: 5,
    color: '#333',
    fontWeight: 500,
  },
  input: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  button: {
    background: '#667eea',
    color: 'white',
    padding: '12px',
    border: 'none',
    borderRadius: '5px',
    fontSize: '16px',
    fontWeight: 500,
    cursor: 'pointer',
  },
};

export default ForgotPassword;
