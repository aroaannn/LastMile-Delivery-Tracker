import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import PlaceOrder from './pages/PlaceOrder';
import OrderTracking from './pages/OrderTracking';
import MyOrders from './pages/MyOrders';
import AgentDashboard from './pages/AgentDashboard';
import AdminDashboard from './pages/AdminDashboard';

function Nav() {
  const { user, logout } = useAuth();
  return (
    <nav>
      <Link to="/">Last-Mile Tracker</Link>
      <div className="spacer" />
      {user && user.role === 'CUSTOMER' && (
        <>
          <Link to="/orders/new">Place Order</Link>
          <Link to="/orders">My Orders</Link>
        </>
      )}
      {user && user.role === 'AGENT' && <Link to="/agent">Agent Dashboard</Link>}
      {user && user.role === 'ADMIN' && <Link to="/admin">Admin Dashboard</Link>}
      {user ? (
        <>
          <span>{user.name} ({user.role})</span>
          <button onClick={logout}>Logout</button>
        </>
      ) : (
        <>
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
        </>
      )}
    </nav>
  );
}

function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function Home() {
  const { user } = useAuth();
  return (
    <div className="container">
      <div className="card">
        <h2>Last-Mile Delivery Tracker</h2>
        <p>
          {user
            ? `Welcome back, ${user.name}. Use the nav above to get started.`
            : 'Please log in or register to place and track deliveries.'}
        </p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Nav />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/orders/new"
            element={
              <Protected roles={['CUSTOMER']}>
                <PlaceOrder />
              </Protected>
            }
          />
          <Route
            path="/orders"
            element={
              <Protected roles={['CUSTOMER']}>
                <MyOrders />
              </Protected>
            }
          />
          <Route
            path="/orders/:id"
            element={
              <Protected>
                <OrderTracking />
              </Protected>
            }
          />
          <Route
            path="/agent"
            element={
              <Protected roles={['AGENT']}>
                <AgentDashboard />
              </Protected>
            }
          />
          <Route
            path="/admin"
            element={
              <Protected roles={['ADMIN']}>
                <AdminDashboard />
              </Protected>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
