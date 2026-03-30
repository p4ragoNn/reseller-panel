import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import logo from "./assets/logo.png";

const supabase = createClient(
  "https://dthorjjuocurcnmcqtqn.supabase.co",
  "sb_publishable_ug_JKewHnvJFSOF3ljphAg_NXDFAa5T"
);

export default function App() {
  const [uuid, setUuid] = useState("");
  const [duration, setDuration] = useState("30");
  const [message, setMessage] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [user, setUser] = useState(null);
  const [credits, setCredits] = useState(0);
  const [role, setRole] = useState(null);

  const [licenses, setLicenses] = useState([]);
  const [apps, setApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState("");

  const [loading, setLoading] = useState(false);

  // ✅ ADMIN STATES
  const [resellers, setResellers] = useState([]);
  const [creditInputs, setCreditInputs] = useState({});

  // 🔐 SESSION
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  // 👤 FETCH USER DATA
  useEffect(() => {
    if (!user) return;

    const fetchUser = async () => {
      const { data } = await supabase
        .from("resellers")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setCredits(data.credits);
        setRole(data.role);
      }
    };

    fetchUser();
  }, [user]);

  // 📦 FETCH APPS
  useEffect(() => {
    const fetchApps = async () => {
      const { data } = await supabase.from("apps").select("*");
      if (data) setApps(data);
    };

    fetchApps();
  }, []);

  // 📄 FETCH LICENSES
  useEffect(() => {
    if (!user) return;

    const fetchLicenses = async () => {
      let query = supabase
       .from("licenses")
.select(`
  *,
  resellers (
    email
  )
`)
        .order("created_at", { ascending: false });

      if (role && role !== "admin") {
        query = query.eq("reseller_id", user.id);
      }

      const { data } = await query;
      if (data) setLicenses(data);
    };

    fetchLicenses();
  }, [user, role]);

  // 👥 FETCH RESELLERS (ADMIN)
  useEffect(() => {
    if (role !== "admin") return;

    const fetchResellers = async () => {
      const { data } = await supabase
        .from("resellers")
        .select("id, email, credits");

      if (data) setResellers(data);
    };

    fetchResellers();
  }, [role]);

  // 🔐 LOGIN
  const login = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return alert(error.message);
    setUser(data.user);
  };

  // 🔓 LOGOUT
  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCredits(0);
    setRole(null);
    setLicenses([]);
    setMessage(null);
  };

  // 🔥 CREATE LICENSE
  const createLicense = async () => {
    if (!selectedApp) return setMessage("Select app ❌");
    if (uuid.length !== 64) return setMessage("UUID must be 64 chars ❌");
    if (role !== "admin" && credits <= 0)
      return setMessage("No credits ❌");

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;

    setLoading(true);
    setMessage("Creating...");

    try {
      const res = await fetch(
        "https://dthorjjuocurcnmcqtqn.supabase.co/functions/v1/create-license",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            uuid,
            app_key: selectedApp,
            days: duration === "lifetime" ? null : parseInt(duration),
          }),
        }
      );

      const data = await res.json();

      if (data.status === "success") {
        setMessage("Created ✅");
        setUuid("");

        if (role !== "admin") setCredits((p) => p - 1);
      } else if (data.status === "exists") {
        setMessage("Already exists ⚠️");
      } else {
        setMessage("Error ❌");
      }
    } catch {
      setMessage("Network error ❌");
    }

    setLoading(false);
    setTimeout(() => setMessage(""), 3000);
  };

  // ❌ REVOKE
  const revokeLicense = async (uuid_hash) => {
    if (role !== "admin") return;

    const { error } = await supabase.rpc("revoke_license", {
      uuid_input: uuid_hash,
    });

    if (error) return alert(error.message);

    setLicenses((prev) =>
      prev.map((l) =>
        l.uuid_hash === uuid_hash ? { ...l, active: false } : l
      )
    );
  };

  // 💰 GIVE CREDITS (ADMIN TABLE)
  const giveCreditsToUser = async (targetId, targetEmail) => {
    if (role !== "admin") return;

    if (targetEmail === user.email) {
      return alert("You cannot give credits to yourself ❌");
    }

    const amount = parseInt(creditInputs[targetId]);
    if (isNaN(amount)) return alert("Invalid amount");

    const { error } = await supabase.rpc("add_credits", {
      target_user: targetId,
      amount,
    });

    if (error) {
      alert(error.message);
    } else {
      alert("Credits added ✅");

      setResellers((prev) =>
        prev.map((r) =>
          r.id === targetId
            ? { ...r, credits: r.credits + amount }
            : r
        )
      );

      setCreditInputs((prev) => ({ ...prev, [targetId]: "" }));
    }
  };

  return (
    <div style={container}>
      <div style={card}>
        <div style={{ textAlign: "center" }}>
          <img src={logo} style={logoStyle} />
          <h1>GR1MZ Panel</h1>
        </div>

        {!user && (
          <>
            <input placeholder="Email" onChange={(e) => setEmail(e.target.value)} style={input} />
            <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} style={input} />
            <button onClick={login} style={btn}>Login</button>
          </>
        )}

        {user && (
          <>
            <p>{user.email}</p>
            <p>Credits: {credits}</p>
            <p>Role: {role}</p>

            <button onClick={logout} style={logoutBtn}>Logout</button>

            {/* ✅ ADMIN TABLE */}
            {role === "admin" && (
              <>
                <h3>Resellers</h3>

                <table style={table}>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Credits</th>
                      <th>Add Credits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resellers.map((r) => (
                      <tr key={r.id}>
                        <td>{r.email}</td>
                        <td>{r.credits}</td>
                        <td>
                          <input
                            type="number"
                            placeholder="Amount"
                            value={creditInputs[r.id] || ""}
                            onChange={(e) =>
                              setCreditInputs((prev) => ({
                                ...prev,
                                [r.id]: e.target.value,
                              }))
                            }
                            style={{ width: 80 }}
                          />

                          <button
                            onClick={() =>
                              giveCreditsToUser(r.id, r.email)
                            }
                            style={{ marginLeft: 5 }}
                          >
                            Add
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* NORMAL PANEL */}
            <input
              placeholder="UUID"
              value={uuid}
              onChange={(e) => setUuid(e.target.value.toUpperCase().trim())}
              style={input}
            />

            <select value={duration} onChange={(e) => setDuration(e.target.value)} style={input}>
              <option value="7">7 Days</option>
              <option value="30">30 Days</option>
              <option value="lifetime">Lifetime</option>
            </select>

            <select value={selectedApp} onChange={(e) => setSelectedApp(e.target.value)} style={input}>
              <option value="">Select App</option>
              {apps.map((app) => (
                <option key={app.id} value={app.app_key}>
  {app.name}
</option>
              ))}
            </select>

            <button onClick={createLicense} style={btn}>
              {loading ? "Creating..." : "Create License"}
            </button>

            <table style={table}>
              <thead>
                <tr>
                  <th>UUID</th>
                  <th>App</th>
                  <th>Expiry</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {licenses.map((l, i) => (
                  <tr key={i}>
                   <td>{l.uuid_hash.slice(0, 8)}...</td>

<td>
  {apps.find((a) => a.app_key === l.app_key)?.name || l.app_key}
</td>

<td>
                        {l.expiry
                            ? new Date(l.expiry).toLocaleDateString()
                            : "Lifetime"}
                    </td>

                    <td
  style={{
    color:
      l.active && (!l.expiry || new Date(l.expiry) > new Date())
        ? "lime"
        : "red",
  }}
>
  {l.active
    ? l.expiry && new Date(l.expiry) < new Date()
      ? "Expired"
      : "Active"
    : "Inactive"}
</td>

                    <td>
                      {role === "admin" &&
  l.active &&
  (!l.expiry || new Date(l.expiry) > new Date()) && (
    <button onClick={() => revokeLicense(l.uuid_hash)}>
      Revoke
    </button>
)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <p>{message}</p>
      </div>
    </div>
  );
}

// 🎨 styles
const container = {
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  background: "#0f172a",
  color: "white",
};

const card = {
  width: 700,
  padding: 20,
  background: "#111827",
  borderRadius: 10,
};

const input = {
  width: "100%",
  padding: 10,
  margin: "10px 0",
};

const btn = {
  width: "100%",
  padding: 10,
  background: "#6366f1",
  color: "white",
};

const logoutBtn = {
  background: "red",
  padding: 5,
  marginBottom: 10,
};

const table = {
  width: "100%",
  marginTop: 20,
};

const logoStyle = {
  width: 80,
  borderRadius: "50%",
};