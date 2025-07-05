import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';

// --- Firebase Configuration (IMPORTANT: REPLACE WITH YOUR ACTUAL PROJECT CONFIG!) ---
// You can get this from your Firebase project settings in the console (Project settings -> General -> Your apps -> Firebase SDK snippet -> Config)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY", // <-- REPLACE THIS with your actual API Key
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com", // <-- REPLACE THIS with your actual Auth Domain (e.g., my-project-12345.firebaseapp.com)
  projectId: "YOUR_PROJECT_ID", // <-- REPLACE THIS with your actual Project ID (e.g., my-project-12345)
  storageBucket: "YOUR_PROJECT_ID.appspot.com", // <-- REPLACE THIS with your actual Storage Bucket (e.g., my-project-12345.appspot.com)
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // <-- REPLACE THIS with your actual Messaging Sender ID
  appId: "YOUR_APP_ID" // <-- REPLACE THIS with your actual App ID
};

// Using projectId as appId for consistency in this local setup
const appId = firebaseConfig.projectId;

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Context for User and Firebase Services ---
const AuthContext = createContext(null);

// Auth Provider Component
function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [userId, setUserId] = useState(null); // Explicitly store userId

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        setUserId(user.uid);
        // Check user role from Firestore
        const userDocRef = doc(db, 'artifacts', appId, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          setIsAdmin(userData.role === 'admin');
        } else {
          // If user doc doesn't exist (new registration), default to employee role
          // This path is primarily for first login after Firebase Auth creates user.
          // For actual registration, role is set in the register function.
          setIsAdmin(false);
          // Set initial user data if it doesn't exist
          await setDoc(userDocRef, {
            email: user.email,
            fullName: user.displayName || 'New Employee',
            role: 'employee', // Default role
            profilePicUrl: null,
            createdAt: serverTimestamp()
          }, { merge: true }); // Use merge in case user was just created by auth
        }
      } else {
        setCurrentUser(null);
        setIsAdmin(false);
        setUserId(null); // Clear userId if no user
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  const value = {
    currentUser,
    isAdmin,
    loadingAuth,
    userId, // Provide userId through context
    auth,
    db,
    appId,
    signIn: async (email, password) => {
      try {
        await signInWithEmailAndPassword(auth, email, password);
        return { success: true };
      } catch (error) {
        console.error("Login error:", error);
        return { success: false, message: error.message };
      }
    },
    register: async (email, password, fullName) => {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        // Firebase Auth doesn't automatically set displayName on creation, so we update it
        await user.updateProfile({ displayName: fullName });

        // Check if the email matches the predefined admin emails for role assignment
        const predefinedAdmins = ['admin00@example.com', 'admin01@example.com', 'admin02@example.com']; // These emails will automatically be assigned admin role
        const role = predefinedAdmins.includes(email) ? 'admin' : 'employee';

        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid), {
            email: user.email,
            fullName: fullName,
            role: role,
            profilePicUrl: null,
            createdAt: serverTimestamp()
        });
        return { success: true };
      } catch (error) {
        console.error("Registration error:", error);
        return { success: false, message: error.message };
      }
    },
    logout: async () => {
      try {
        await signOut(auth);
        return { success: true };
      } catch (error) {
        console.error("Logout error:", error);
        return { success: false, message: error.message };
      }
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {!loadingAuth && children}
    </AuthContext.Provider>
  );
}

// Custom hook to use AuthContext
const useAuth = () => {
  return useContext(AuthContext);
};

// --- Utility for Philippine Time ---
const getPhilippineTime = (date) => {
    // Format the date to 'en-US' locale, then create a new Date object from that string
    // to correctly apply the timezone offset for 'Asia/Manila'
    const options = {
        timeZone: 'Asia/Manila',
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
        hourCycle: 'h23' // Use 24-hour format to avoid AM/PM issues
    };
    const philippineTimeString = new Intl.DateTimeFormat('en-US', options).format(date);
    return new Date(philippineTimeString); // Re-parse the formatted string in local time
};


// --- Components ---

// Login/Register Component
function AuthScreen({ onLoginSuccess }) {
  const { signIn, register, currentUser } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (currentUser) {
      onLoginSuccess();
    }
  }, [currentUser, onLoginSuccess]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    let result;
    if (isLogin) {
      result = await signIn(email, password);
    } else {
      result = await register(email, password, fullName);
    }
    if (!result.success) {
      setMessage(result.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6 rounded-md p-2 bg-blue-100">
          {isLogin ? 'Login' : 'Register'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="fullName">
                Full Name
              </label>
              <input
                type="text"
                id="fullName"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required={!isLogin}
              />
            </div>
          )}
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="email">
              Email
            </label>
            <input
              type="email"
              id="email"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="password">
              Password
            </label>
            <input
              type="password"
              id="password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {message && (
            <p className="text-red-500 text-sm text-center">{message}</p>
          )}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 shadow-md"
          >
            {isLogin ? 'Login' : 'Register'}
          </button>
        </form>
        <p className="text-center text-gray-600 mt-4">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-600 hover:underline font-semibold"
          >
            {isLogin ? 'Register here' : 'Login here'}
          </button>
        </p>
        <p className="text-center text-gray-500 text-xs mt-2">
            For admin access, register using emails like `admin00@example.com`, `admin01@example.com`, or `admin02@example.com`.
        </p>
      </div>
    </div>
  );
}

// Modal Component for Camera/Messages
const Modal = ({ show, onClose, children }) => {
    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl shadow-2xl max-w-lg w-full relative">
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 text-2xl font-bold"
                >
                    &times;
                </button>
                {children}
            </div>
        </div>
    );
};

// Camera Component
function CameraCapture({ onCapture, onClose }) {
    const videoRef = React.useRef(null);
    const canvasRef = React.useRef(null);
    const [stream, setStream] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const startCamera = async () => {
            try {
                // Request camera facing the user (front camera)
                const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                setStream(mediaStream);
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }
            } catch (err) {
                console.error("Error accessing camera:", err);
                setError("Failed to access camera. Please ensure camera permissions are granted and no other app is using it.");
            }
        };

        startCamera();

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [stream]); // Added stream to dependencies to ensure effect re-runs if stream changes state

    const takePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
            const imageDataUrl = canvasRef.current.toDataURL('image/png'); // Get image as data URL
            onCapture(imageDataUrl); // Pass data URL to parent component
            onClose(); // Close the camera modal after capture
        }
    };

    return (
        <div className="flex flex-col items-center space-y-4">
            <h3 className="text-2xl font-semibold text-gray-800">Take a Selfie</h3>
            {error && <p className="text-red-500 text-center">{error}</p>}
            <video ref={videoRef} autoPlay playsInline className="w-full max-w-sm rounded-lg shadow-md border border-gray-300"></video>
            <canvas ref={canvasRef} className="hidden"></canvas> {/* Hidden canvas for capturing */}
            <button
                onClick={takePhoto}
                disabled={!stream} // Disable if camera stream is not available
                className="bg-green-600 text-white py-3 px-6 rounded-full hover:bg-green-700 transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 shadow-lg"
            >
                Capture Photo
            </button>
        </div>
    );
}

// Employee Dashboard
function EmployeeDashboard() {
  const { currentUser, userId, logout, db, appId } = useAuth();
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [message, setMessage] = useState('');
  const [attendanceStatus, setAttendanceStatus] = useState(null); // { type: 'clockIn'/'clockOut', timestamp: Date }
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [profilePic, setProfilePic] = useState(null);
  const [showProfilePicModal, setShowProfilePicModal] = useState(false);

  // Fetch current attendance status and history
  useEffect(() => {
    if (!userId) return;

    const attendanceRef = collection(db, 'artifacts', appId, 'users', userId, 'attendance');
    const q = query(attendanceRef);

    const unsubscribeAttendance = onSnapshot(q, (snapshot) => {
        const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                                    .sort((a, b) => {
                                        // Ensure timestamp is a Date object before comparison
                                        const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
                                        const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
                                        return dateB - dateA;
                                    }); // Sort descending by timestamp
        setAttendanceHistory(history);

        // Determine current status (based on the very last action)
        const lastEntry = history.length > 0 ? history[0] : null;
        if (lastEntry) {
            setAttendanceStatus(lastEntry);
        } else {
            setAttendanceStatus(null); // No entries yet
        }
    }, (error) => {
        console.error("Error fetching attendance:", error);
        setMessage("Error loading attendance history.");
    });

    // Fetch payslips
    const payslipsRef = collection(db, 'artifacts', appId, 'users', userId, 'payslips');
    const unsubscribePayslips = onSnapshot(payslipsRef, (snapshot) => {
        const fetchedPayslips = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                                            .sort((a, b) => {
                                                const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
                                                const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                                                return dateB - dateA;
                                            });
        setPayslips(fetchedPayslips);
    }, (error) => {
        console.error("Error fetching payslips:", error);
        setMessage("Error loading payslips.");
    });

    // Fetch profile picture
    const userDocRef = doc(db, 'artifacts', appId, 'users', userId);
    const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            setProfilePic(docSnap.data().profilePicUrl);
        }
    }, (error) => {
        console.error("Error fetching profile picture:", error);
    });

    return () => {
        unsubscribeAttendance();
        unsubscribePayslips();
        unsubscribeProfile();
    };
  }, [userId, db, appId]);


  const handleClockAction = async (type, imageDataUrl) => {
    setMessage('');
    try {
        const now = new Date();
        const philippineTime = getPhilippineTime(now);

        // Get employee's set start and end times (from admin settings)
        const employeeDetailsRef = doc(db, 'artifacts', appId, 'employeeDetails', userId);
        const employeeDetailsSnap = await getDoc(employeeDetailsRef);
        let startTimeHour = 10;
        let startTimeMinute = 0;
        let endTimeHour = 19; // 7 PM
        let endTimeMinute = 0;

        if (employeeDetailsSnap.exists()) {
            const details = employeeDetailsSnap.data();
            startTimeHour = details.startTime?.hour || 10;
            startTimeMinute = details.startTime?.minute || 0;
            endTimeHour = details.endTime?.hour || 19;
            endTimeMinute = details.endTime?.minute || 0;
        }

        const currentHour = philippineTime.getHours();
        const currentMinute = philippineTime.getMinutes();

        let effectiveTime = new Date(philippineTime); // Start with actual Philippine time
        let status = 'onTime';
        let isOvertime = false;

        if (type === 'clockIn') {
            // If clock in before set start time, effective time is set start time
            if (currentHour < startTimeHour || (currentHour === startTimeHour && currentMinute < startTimeMinute)) {
                effectiveTime.setHours(startTimeHour, startTimeMinute, 0, 0);
                status = 'early';
            }
            // If clocked in after start time (e.g., 10:01 AM), it's still 'onTime' for simplicity in this logic
            // For 'late' clock-in status, you would add a check like currentHour > startTimeHour
        } else if (type === 'clockOut') {
            // If clock out after set end time (7 PM)
            if (currentHour > endTimeHour || (currentHour === endTimeHour && currentMinute > endTimeMinute)) {
                // Calculate difference from 7 PM
                const endDateTime = new Date(effectiveTime);
                endDateTime.setHours(endTimeHour, endTimeMinute, 0, 0);

                const diffMinutes = (philippineTime.getTime() - endDateTime.getTime()) / (1000 * 60);

                // If clocked out at 8:01 PM or later (61 minutes after 7 PM)
                if (diffMinutes >= 61) { // 7:00 PM + 61 minutes = 8:01 PM
                    isOvertime = true;
                    status = 'overtime';
                } else {
                    // Clock out between 7:01 PM and 8:00 PM (inclusive)
                    // Still counted as 7 PM for regular hours, marked as 'late'
                    effectiveTime.setHours(endTimeHour, endTimeMinute, 0, 0);
                    status = 'late';
                }
            }
        }

        const attendanceData = {
            timestamp: serverTimestamp(), // Use server timestamp for consistency
            philippineTime: effectiveTime.toISOString(), // Store the calculated effective time
            type: type,
            selfieUrl: imageDataUrl,
            status: status,
            isOvertime: isOvertime, // Flag for overtime calculation
            rawTimestamp: now.toISOString(), // Store original timestamp for debugging/auditing
        };

        await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'attendance'), attendanceData);
        setMessage(`${type === 'clockIn' ? 'Clocked In' : 'Clocked Out'} successfully at ${philippineTime.toLocaleTimeString('en-PH', {hour: '2-digit', minute:'2-digit'})}!`);
        setShowCameraModal(false); // Close modal after successful action
    } catch (error) {
        console.error("Error clocking in/out:", error);
        setMessage("Failed to record. " + error.message);
    }
  };

  const handleProfilePicUpload = async (imageDataUrl) => {
    setMessage('');
    try {
        const userDocRef = doc(db, 'artifacts', appId, 'users', userId);
        await updateDoc(userDocRef, { profilePicUrl: imageDataUrl });
        setMessage('Profile picture updated successfully!');
        setShowProfilePicModal(false);
    } catch (error) {
        console.error("Error uploading profile picture:", error);
        setMessage("Failed to upload profile picture. " + error.message);
    }
  };

  const isClockedIn = attendanceStatus?.type === 'clockIn';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 font-inter text-gray-800">
      <header className="flex justify-between items-center bg-white p-6 rounded-xl shadow-lg mb-6">
        <h1 className="text-4xl font-extrabold text-blue-700">Employee Dashboard</h1>
        <div className="flex items-center space-x-4">
            {profilePic && (
                <img
                    src={profilePic}
                    alt="Profile"
                    className="w-16 h-16 rounded-full object-cover border-4 border-blue-300 shadow-md cursor-pointer"
                    onClick={() => setShowProfilePicModal(true)}
                />
            )}
            <span className="text-xl font-semibold text-gray-700">{currentUser?.displayName || currentUser?.email}</span>
            <button
                onClick={logout}
                className="bg-red-500 text-white py-2 px-5 rounded-lg hover:bg-red-600 transition duration-200 ease-in-out transform hover:scale-105 shadow-md"
            >
                Logout
            </button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Clock In/Out Section */}
        <section className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-center space-y-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Time Tracking</h2>
          <p className={`text-xl font-semibold ${isClockedIn ? 'text-green-600' : 'text-red-600'}`}>
            Status: {isClockedIn ? 'Clocked In' : 'Clocked Out'}
          </p>
          {attendanceStatus && (
              <p className="text-lg text-gray-600">
                  Last Action: {attendanceStatus.type} at {new Date(attendanceStatus.philippineTime).toLocaleTimeString('en-PH', {hour: '2-digit', minute:'2-digit'})}
              </p>
          )}
          <div className="flex space-x-4">
            <button
              onClick={() => setShowCameraModal(true)}
              disabled={isClockedIn}
              className={`py-3 px-8 rounded-full text-xl font-bold transition duration-300 ease-in-out transform hover:scale-105 shadow-lg
                ${isClockedIn ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              Clock In
            </button>
            <button
              onClick={() => setShowCameraModal(true)}
              disabled={!isClockedIn}
              className={`py-3 px-8 rounded-full text-xl font-bold transition duration-300 ease-in-out transform hover:scale-105 shadow-lg
                ${!isClockedIn ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}`}
            >
              Clock Out
            </button>
          </div>
          {message && (
            <p className={`text-center text-sm mt-4 ${message.includes('successfully') ? 'text-green-600' : 'text-red-500'}`}>
              {message}
            </p>
          )}
        </section>

        {/* Attendance History */}
        <section className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Attendance History</h2>
          {attendanceHistory.length === 0 ? (
            <p className="text-gray-600">No attendance records yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg overflow-hidden">
                <thead className="bg-blue-500 text-white">
                  <tr>
                    <th className="py-3 px-4 text-left">Date</th>
                    <th className="py-3 px-4 text-left">Time (PH)</th>
                    <th className="py-3 px-4 text-left">Action</th>
                    <th className="py-3 px-4 text-left">Status</th>
                    <th className="py-3 px-4 text-left">Selfie</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceHistory.map((record) => (
                    <tr key={record.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-3 px-4">{new Date(record.philippineTime).toLocaleDateString('en-PH')}</td>
                      <td className="py-3 px-4">{new Date(record.philippineTime).toLocaleTimeString('en-PH', {hour: '2-digit', minute:'2-digit'})}</td>
                      <td className={`py-3 px-4 font-semibold ${record.type === 'clockIn' ? 'text-green-600' : 'text-red-600'}`}>
                        {record.type}
                      </td>
                      <td className="py-3 px-4">{record.status} {record.isOvertime && '(OT)'}</td>
                      <td className="py-3 px-4">
                        {record.selfieUrl && (
                          <img src={record.selfieUrl} alt="Selfie" className="w-16 h-16 object-cover rounded-md shadow-sm" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Payslips Section */}
        <section className="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">My Payslips</h2>
          {payslips.length === 0 ? (
            <p className="text-gray-600">No payslips available yet.</p>
          ) : (
            <ul className="space-y-3">
              {payslips.map((payslip) => (
                <li key={payslip.id} className="bg-gray-50 p-4 rounded-lg flex justify-between items-center shadow-sm">
                  <span className="text-lg font-medium">Payslip for {new Date(payslip.date.toDate()).toLocaleDateString('en-PH', { year: 'numeric', month: 'long' })}</span>
                  {payslip.content && (
                    <button
                      onClick={() => alert(`Payslip Content:\n${payslip.content}`)} // Replace with a proper modal later
                      className="bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition duration-200"
                    >
                      View
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Profile Picture Upload Section */}
        <section className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-center">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Update Profile Picture</h2>
            <button
                onClick={() => setShowProfilePicModal(true)}
                className="bg-indigo-600 text-white py-3 px-6 rounded-full hover:bg-indigo-700 transition duration-200 ease-in-out transform hover:scale-105 shadow-lg"
            >
                {profilePic ? 'Change Profile Picture' : 'Upload Profile Picture'}
            </button>
        </section>
      </main>

      {/* Camera Modal */}
      <Modal show={showCameraModal} onClose={() => setShowCameraModal(false)}>
        <CameraCapture
          onCapture={(imageDataUrl) => handleClockAction(isClockedIn ? 'clockOut' : 'clockIn', imageDataUrl)}
          onClose={() => setShowCameraModal(false)}
        />
      </Modal>

      {/* Profile Picture Upload Modal */}
      <Modal show={showProfilePicModal} onClose={() => setShowProfilePicModal(false)}>
        <CameraCapture
            onCapture={handleProfilePicUpload}
            onClose={() => setShowProfilePicModal(false)}
        />
      </Modal>
    </div>
  );
}

// Admin Dashboard
function AdminDashboard() {
  const { userId, logout, db, appId } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEmployeeDetailsModal, setShowEmployeeDetailsModal] = useState(false);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [payslipContent, setPayslipContent] = useState('');
  const [message, setMessage] = useState('');
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedEmployeeAttendance, setSelectedEmployeeAttendance] = useState([]);

  // Form states for employee details
  const [hourlyRate, setHourlyRate] = useState('');
  const [overtimeRate, setOvertimeRate] = useState('');
  const [position, setPosition] = useState('');
  const [startTimeHour, setStartTimeHour] = useState('10');
  const [startTimeMinute, setStartTimeMinute] = useState('00');
  const [endTimeHour, setEndTimeHour] = useState('19'); // 7 PM
  const [endTimeMinute, setEndTimeMinute] = useState('00');

  // Fetch all employees and their details
  useEffect(() => {
    if (!userId) return;

    const usersRef = collection(db, 'artifacts', appId, 'users');
    const q = query(usersRef, where('role', '==', 'employee'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const fetchedEmployees = await Promise.all(snapshot.docs.map(async (userDoc) => {
        const userData = userDoc.data();
        const employeeDetailsRef = doc(db, 'artifacts', appId, 'employeeDetails', userDoc.id);
        const detailsSnap = await getDoc(employeeDetailsRef);
        const details = detailsSnap.exists() ? detailsSnap.data() : {};
        return {
          id: userDoc.id,
          ...userData,
          ...details,
        };
      }));
      setEmployees(fetchedEmployees);
    }, (error) => {
      console.error("Error fetching employees:", error);
      setMessage("Error loading employee list.");
    });

    return () => unsubscribe();
  }, [userId, db, appId]);

  const handleSelectEmployee = (employee) => {
    setSelectedEmployee(employee);
    setHourlyRate(employee.hourlyRate || '');
    setOvertimeRate(employee.overtimeRate || '');
    setPosition(employee.position || '');
    setStartTimeHour(employee.startTime?.hour?.toString().padStart(2, '0') || '10');
    setStartTimeMinute(employee.startTime?.minute?.toString().padStart(2, '0') || '00');
    setEndTimeHour(employee.endTime?.hour?.toString().padStart(2, '0') || '19');
    setEndTimeMinute(employee.endTime?.minute?.toString().padStart(2, '0') || '00');
    setShowEmployeeDetailsModal(true);
  };

  const handleSaveEmployeeDetails = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!selectedEmployee) return;

    try {
      const employeeDetailsRef = doc(db, 'artifacts', appId, 'employeeDetails', selectedEmployee.id);
      await setDoc(employeeDetailsRef, {
        hourlyRate: parseFloat(hourlyRate),
        overtimeRate: parseFloat(overtimeRate),
        position: position,
        startTime: { hour: parseInt(startTimeHour), minute: parseInt(startTimeMinute) },
        endTime: { hour: parseInt(endTimeHour), minute: parseInt(endTimeMinute) },
      }, { merge: true }); // Use merge to update existing fields without overwriting others

      setMessage('Employee details updated successfully!');
      setShowEmployeeDetailsModal(false);
    } catch (error) {
      console.error("Error saving employee details:", error);
      setMessage("Failed to save employee details. " + error.message);
    }
  };

  const handleSendPayslip = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!selectedEmployee || !payslipContent) return;

    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', selectedEmployee.id, 'payslips'), {
        date: serverTimestamp(),
        content: payslipContent,
        sentByAdminId: userId,
      });
      setMessage('Payslip sent successfully!');
      setPayslipContent('');
      setShowPayslipModal(false);
    } catch (error) {
      console.error("Error sending payslip:", error);
      setMessage("Failed to send payslip. " + error.message);
    }
  };

  const handleViewAttendance = async (employee) => {
      setSelectedEmployee(employee);
      setShowAttendanceModal(true);
      setMessage('');
      try {
          const attendanceRef = collection(db, 'artifacts', appId, 'users', employee.id, 'attendance');
          const q = query(attendanceRef);
          const unsubscribe = onSnapshot(q, (snapshot) => {
              const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                                          .sort((a, b) => {
                                              const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
                                              const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
                                              return dateB - dateA;
                                          });
              setSelectedEmployeeAttendance(history);
          }, (error) => {
              console.error("Error fetching employee attendance:", error);
              setMessage("Error loading employee attendance.");
          });
          // Store unsubscribe function to clean up on component unmount or modal close
          // For simplicity here, we'll just let it update while modal is open.
          // In a real app, you'd manage this more robustly.
      } catch (error) {
          console.error("Error setting up attendance listener:", error);
          setMessage("Failed to load attendance. " + error.message);
      }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4 font-inter text-gray-800">
      <header className="flex justify-between items-center bg-white p-6 rounded-xl shadow-lg mb-6">
        <h1 className="text-4xl font-extrabold text-purple-700">Admin Dashboard</h1>
        <div className="flex items-center space-x-4">
            <span className="text-xl font-semibold text-gray-700">Admin User: {currentUser?.email || userId}</span>
            <button
                onClick={logout}
                className="bg-red-500 text-white py-2 px-5 rounded-lg hover:bg-red-600 transition duration-200 ease-in-out transform hover:scale-105 shadow-md"
            >
                Logout
            </button>
        </div>
      </header>

      <main className="bg-white p-6 rounded-xl shadow-lg">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">Manage Employees</h2>
        {message && (
            <p className={`text-center text-sm mb-4 ${message.includes('successfully') ? 'text-green-600' : 'text-red-500'}`}>
                {message}
            </p>
        )}
        {employees.length === 0 ? (
          <p className="text-gray-600">No employees registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white rounded-lg overflow-hidden">
              <thead className="bg-purple-500 text-white">
                <tr>
                  <th className="py-3 px-4 text-left">Profile</th>
                  <th className="py-3 px-4 text-left">Full Name</th>
                  <th className="py-3 px-4 text-left">Email</th>
                  <th className="py-3 px-4 text-left">Position</th>
                  <th className="py-3 px-4 text-left">Hourly Rate</th>
                  <th className="py-3 px-4 text-left">Overtime Rate</th>
                  <th className="py-3 px-4 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-4">
                        {employee.profilePicUrl ? (
                            <img src={employee.profilePicUrl} alt="Profile" className="w-12 h-12 rounded-full object-cover border-2 border-purple-200" />
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs">No Pic</div>
                        )}
                    </td>
                    <td className="py-3 px-4 font-medium">{employee.fullName}</td>
                    <td className="py-3 px-4">{employee.email}</td>
                    <td className="py-3 px-4">{employee.position || 'N/A'}</td>
                    <td className="py-3 px-4">₱{employee.hourlyRate?.toFixed(2) || 'N/A'}</td>
                    <td className="py-3 px-4">₱{employee.overtimeRate?.toFixed(2) || 'N/A'}</td>
                    <td className="py-3 px-4 flex space-x-2">
                      <button
                        onClick={() => handleSelectEmployee(employee)}
                        className="bg-blue-500 text-white py-1 px-3 rounded-md text-sm hover:bg-blue-600 transition duration-200"
                      >
                        Edit Details
                      </button>
                      <button
                        onClick={() => { setSelectedEmployee(employee); setShowPayslipModal(true); }}
                        className="bg-green-500 text-white py-1 px-3 rounded-md text-sm hover:bg-green-600 transition duration-200"
                      >
                        Send Payslip
                      </button>
                      <button
                        onClick={() => handleViewAttendance(employee)}
                        className="bg-indigo-500 text-white py-1 px-3 rounded-md text-sm hover:bg-indigo-600 transition duration-200"
                      >
                        View Attendance
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Employee Details Modal */}
      <Modal show={showEmployeeDetailsModal} onClose={() => setShowEmployeeDetailsModal(false)}>
        <h3 className="text-2xl font-semibold text-gray-800 mb-4">Edit Employee Details: {selectedEmployee?.fullName}</h3>
        <form onSubmit={handleSaveEmployeeDetails} className="space-y-4">
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="position">Position</label>
            <input
              type="text"
              id="position"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="hourlyRate">Hourly Rate (PHP)</label>
            <input
              type="number"
              id="hourlyRate"
              step="0.01"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="overtimeRate">Overtime Rate (PHP)</label>
            <input
              type="number"
              id="overtimeRate"
              step="0.01"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={overtimeRate}
              onChange={(e) => setOvertimeRate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-gray-700 text-sm font-semibold mb-2">Start Time (PH)</label>
                <div className="flex space-x-2">
                    <select
                        className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={startTimeHour}
                        onChange={(e) => setStartTimeHour(e.target.value)}
                    >
                        {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                            <option key={hour} value={hour.toString().padStart(2, '0')}>
                                {hour.toString().padStart(2, '0')}
                            </option>
                        ))}
                    </select>
                    <select
                        className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={startTimeMinute}
                        onChange={(e) => setStartTimeMinute(e.target.value)}
                    >
                        {Array.from({ length: 60 }, (_, i) => i).map(minute => (
                            <option key={minute} value={minute.toString().padStart(2, '0')}>
                                {minute.toString().padStart(2, '0')}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <div>
                <label className="block text-gray-700 text-sm font-semibold mb-2">End Time (PH)</label>
                <div className="flex space-x-2">
                    <select
                        className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={endTimeHour}
                        onChange={(e) => setEndTimeHour(e.target.value)}
                    >
                        {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                            <option key={hour} value={hour.toString().padStart(2, '0')}>
                                {hour.toString().padStart(2, '0')}
                            </option>
                        ))}
                    </select>
                    <select
                        className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={endTimeMinute}
                        onChange={(e) => setEndTimeMinute(e.target.value)}
                    >
                        {Array.from({ length: 60 }, (_, i) => i).map(minute => (
                            <option key={minute} value={minute.toString().padStart(2, '0')}>
                                {minute.toString().padStart(2, '0')}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200 ease-in-out transform hover:scale-105 shadow-md"
          >
            Save Details
          </button>
        </form>
      </Modal>

      {/* Send Payslip Modal */}
      <Modal show={showPayslipModal} onClose={() => setShowPayslipModal(false)}>
        <h3 className="text-2xl font-semibold text-gray-800 mb-4">Send Payslip to {selectedEmployee?.fullName}</h3>
        <form onSubmit={handleSendPayslip} className="space-y-4">
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="payslipContent">Payslip Content (Text or URL)</label>
            <textarea
              id="payslipContent"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 h-32"
              value={payslipContent}
              onChange={(e) => setPayslipContent(e.target.value)}
              placeholder="Enter payslip details or a link to a PDF/image."
              required
            ></textarea>
          </div>
          <button
            type="submit"
            className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition duration-200 ease-in-out transform hover:scale-105 shadow-md"
          >
            Send Payslip
          </button>
        </form>
      </Modal>

      {/* View Attendance Modal */}
      <Modal show={showAttendanceModal} onClose={() => setShowAttendanceModal(false)}>
        <h3 className="text-2xl font-semibold text-gray-800 mb-4">Attendance for {selectedEmployee?.fullName}</h3>
        {selectedEmployeeAttendance.length === 0 ? (
            <p className="text-gray-600">No attendance records for this employee yet.</p>
        ) : (
            <div className="overflow-x-auto max-h-96">
                <table className="min-w-full bg-white rounded-lg overflow-hidden">
                    <thead className="bg-indigo-500 text-white">
                        <tr>
                            <th className="py-2 px-3 text-left text-sm">Date</th>
                            <th className="py-2 px-3 text-left text-sm">Time (PH)</th>
                            <th className="py-2 px-3 text-left text-sm">Action</th>
                            <th className="py-2 px-3 text-left text-sm">Status</th>
                            <th className="py-2 px-3 text-left text-sm">Selfie</th>
                        </tr>
                    </thead>
                    <tbody>
                        {selectedEmployeeAttendance.map((record) => (
                            <tr key={record.id} className="border-b border-gray-200 hover:bg-gray-50">
                                <td className="py-2 px-3 text-sm">{new Date(record.philippineTime).toLocaleDateString('en-PH')}</td>
                                <td className="py-2 px-3 text-sm">{new Date(record.philippineTime).toLocaleTimeString('en-PH', {hour: '2-digit', minute:'2-digit'})}</td>
                                <td className={`py-2 px-3 text-sm font-semibold ${record.type === 'clockIn' ? 'text-green-600' : 'text-red-600'}`}>
                                    {record.type}
                                </td>
                                <td className="py-2 px-3 text-sm">{record.status} {record.isOvertime && '(OT)'}</td>
                                <td className="py-2 px-3 text-sm">
                                    {record.selfieUrl && (
                                        <img src={record.selfieUrl} alt="Selfie" className="w-12 h-12 object-cover rounded-md shadow-sm" />
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
      </Modal>
    </div>
  );
}


// Main App Component
function App() {
  const { currentUser, isAdmin, loadingAuth } = useAuth();
  const [view, setView] = useState('auth'); // 'auth', 'employee', 'admin'

  useEffect(() => {
    if (!loadingAuth) {
      if (currentUser) {
        if (isAdmin) {
          setView('admin');
        } else {
          setView('employee');
        }
      } else {
        setView('auth');
      }
    }
  }, [currentUser, isAdmin, loadingAuth]);

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Loading...</div>
      </div>
    );
  }

  return (
    <div className="App">
      {view === 'auth' && <AuthScreen onLoginSuccess={() => setView(isAdmin ? 'admin' : 'employee')} />}
      {view === 'employee' && <EmployeeDashboard />}
      {view === 'admin' && <AdminDashboard />}
    </div>
  );
}

export default function AppWrapper() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}
