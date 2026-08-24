import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await client.post('/auth/register', form);
      login(res.data.token, res.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  }

  return (
    <div className="container" style={{ maxWidth: 400 }}>
      <div className="card">
        <h2>Register (Customer)</h2>
        <form onSubmit={handleSubmit}>
          <label><span>Name</span><input value={form.name} onChange={update('name')} required style={{ width: '100%' }} /></label>
          <label><span>Email</span><input type="email" value={form.email} onChange={update('email')} required style={{ width: '100%' }} /></label>
          <label><span>Phone</span><input value={form.phone} onChange={update('phone')} style={{ width: '100%' }} /></label>
          <label><span>Password</span><input type="password" value={form.password} onChange={update('password')} required style={{ width: '100%' }} /></label>
          {error && <div className="error">{error}</div>}
          <button type="submit">Create account</button>
        </form>
      </div>
    </div>
  );
}
