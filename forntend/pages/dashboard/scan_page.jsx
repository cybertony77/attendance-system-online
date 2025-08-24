import { useEffect, useState, useRef, useMemo } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useRouter } from "next/router";
import { AVAILABLE_CENTERS } from "../../constants/centers";
import Title from "../../components/Title";
import AttendanceWeekSelect from "../../components/AttendanceWeekSelect";
import CenterSelect from "../../components/CenterSelect";
import { useStudent, useToggleAttendance, useUpdateHomework, useUpdatePayment, useUpdateQuizGrade } from "../../lib/api/students";

// Helper to extract student ID from QR text (URL or plain number)
function extractStudentId(qrText) {
  try {
    // Try to parse as URL and extract id param
    const url = new URL(qrText);
    const id = url.searchParams.get('id');
    if (id) return id;
  } catch (e) {
    // Not a URL, fall through
  }
  // Fallback: if it's just a number
  if (/^\d+$/.test(qrText)) {
    return qrText;
  }
  return null;
}

export default function QR() {
  const containerRef = useRef(null);
  const [studentId, setStudentId] = useState("");
  const [searchId, setSearchId] = useState(""); // Separate state for search
  const [error, setError] = useState("");
  const [attendSuccess, setAttendSuccess] = useState(false);
  const [scanner, setScanner] = useState(null);
  const [attendanceCenter, setAttendanceCenter] = useState("");
  const [selectedWeek, setSelectedWeek] = useState("");
  const [quizDegreeInput, setQuizDegreeInput] = useState("");
  const [quizDegreeOutOf, setQuizDegreeOutOf] = useState("");
  const [openDropdown, setOpenDropdown] = useState(null); // 'week', 'center', or null
  // Simple optimistic state for immediate UI feedback
  const [optimisticHwDone, setOptimisticHwDone] = useState(null);
  const [optimisticPaidSession, setOptimisticPaidSession] = useState(null);
  const [optimisticAttended, setOptimisticAttended] = useState(null);
  const router = useRouter();

  // React Query hooks with enhanced real-time updates
  const { data: rawStudent, isLoading: studentLoading, error: studentError } = useStudent(searchId, { 
    enabled: !!searchId,
    // Enhanced real-time settings
    refetchInterval: 5 * 1000, // Refetch every 5 seconds for real-time updates
    refetchIntervalInBackground: true, // Continue when tab is not active
    refetchOnWindowFocus: true, // Immediate update when switching back to tab
    staleTime: 0, // Always consider data stale for immediate updates
  });
  const toggleAttendanceMutation = useToggleAttendance();
  const updateHomeworkMutation = useUpdateHomework();
  const updatePaymentMutation = useUpdatePayment();
  const updateQuizGradeMutation = useUpdateQuizGrade();

  // Load remembered values from sessionStorage
  useEffect(() => {
    const rememberedCenter = sessionStorage.getItem('lastAttendanceCenter');
    const rememberedWeek = sessionStorage.getItem('lastSelectedWeek');
    
    if (rememberedCenter) {
      setAttendanceCenter(rememberedCenter);
    }
    if (rememberedWeek) {
      setSelectedWeek(rememberedWeek);
    }
  }, []);

  useEffect(() => {
    const t = sessionStorage.getItem("token");
    if (!t) {
      router.push("/");
      return;
    }
  }, [router]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpenDropdown(null);
        // Also blur any focused input to close browser autocomplete
        if (document.activeElement && document.activeElement.tagName === 'INPUT') {
          document.activeElement.blur();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Helper function to convert week string to numeric index
  const getWeekNumber = (weekString) => {
    if (!weekString) return null;
    const match = weekString.match(/week (\d+)/);
    const result = match ? parseInt(match[1]) : null;
    console.log('🔧 Converting week string:', { weekString, result });
    return result;
  };

  // Helper function to get current week data
  const getCurrentWeekData = (student, weekString) => {
    if (!student.weeks || !weekString) return null;
    const weekNumber = getWeekNumber(weekString);
    if (!weekNumber) return null;
    const weekIndex = weekNumber - 1;
    return student.weeks[weekIndex] || null;
  };

  // Helper function to update student state with current week data
  const updateStudentWithWeekData = (student, weekString) => {
    const weekData = getCurrentWeekData(student, weekString);
    if (!weekData) return student;
    
    return {
      ...student,
      attended_the_session: weekData.attended,
      lastAttendance: weekData.lastAttendance,
      lastAttendanceCenter: weekData.lastAttendanceCenter,
      hwDone: weekData.hwDone,
      paidSession: weekData.paidSession,
      quizDegree: weekData.quizDegree
    };
  };

  // Update student data with current week information using useMemo
  const student = useMemo(() => {
    if (rawStudent && selectedWeek) {
      return updateStudentWithWeekData(rawStudent, selectedWeek);
    }
    return rawStudent;
  }, [rawStudent, selectedWeek]);

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (studentId.trim()) {
      // Set the search ID to trigger the fetch
      setSearchId(studentId.trim());
    }
  };



  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    
  }, [studentId, student]);

  useEffect(() => {
    const qrScanner = new Html5QrcodeScanner(
      "qr-reader",
      { 
        fps: 10, 
        qrbox: { width: 300, height: 300 },
        aspectRatio: 1.0
      },
      false
    );

    qrScanner.render((decodedText) => {
      if (decodedText && decodedText !== studentId) {
        // Clear previous student data when new QR is scanned
        setError("");
        setAttendSuccess(false);
        
        // Extract student ID from QR code (URL or number)
        const extractedId = extractStudentId(decodedText);
        if (extractedId) {
          setStudentId(extractedId);
          setSearchId(extractedId); // Trigger fetch for QR scanned student
        } else {
          setError('Invalid QR code: not a valid student ID');
        }
      }
    }, (errorMessage) => {
      // Clear student data when QR scan fails
      if (errorMessage && typeof errorMessage === 'string') {
        setAttendSuccess(false);
        
        if (errorMessage.includes("NotFoundException")) {
          setError("QR code not readable. Please try again.");
        } else if (errorMessage.includes("No MultiFormat Readers")) {
          setError("QR code not readable. Please try again.");
        } else {
          setError("QR scan error. Please try again.");
        }
      } else if (errorMessage) {
        // Handle non-string error messages
        setAttendSuccess(false);
        setError("QR scan error. Please try again.");
      }
    });

    setScanner(qrScanner);

    return () => {
      if (qrScanner) {
        qrScanner.clear();
      }
    };
  }, [studentId]);

  // Auto-hide error after 6 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError("") , 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Handle student errors from React Query
  useEffect(() => {
    if (studentError) {
      setError("Student not found or unauthorized.");
    }
  }, [studentError]);

  // Clear optimistic state when student or week changes
  useEffect(() => {
    setOptimisticHwDone(null);
    setOptimisticPaidSession(null);
    setOptimisticAttended(null);
  }, [student?.id, selectedWeek]);

  // Reset HW/Paid optimistic states when attendance becomes false
  useEffect(() => {
    const currentAttended = optimisticAttended !== null ? optimisticAttended : student?.attended_the_session;
    if (currentAttended === false) {
      // If attendance is false, reset other optimistic states to false/null
      setOptimisticHwDone(false);
      setOptimisticPaidSession(false);
      // Clear quiz degree inputs as well
      setQuizDegreeInput("");
      setQuizDegreeOutOf("");
      // Note: Quiz degree in DB will be handled by the backend reset
    }
  }, [optimisticAttended, student?.attended_the_session]);



  const updateAttendanceWeek = async (week) => {
    if (!student) return;
    
    try {
      // Remember the selected week
      if (week) {
        sessionStorage.setItem('lastSelectedWeek', week);
      }
    } catch (err) {
      console.error("Failed to update attendance week:", err);
    }
  };

  const toggleAttendance = async () => {
    if (!student || !selectedWeek || !attendanceCenter) return;
    
    // Use current displayed state (optimistic if available, otherwise DB state)
    const currentAttended = optimisticAttended !== null ? optimisticAttended : student.attended_the_session;
    const newAttended = !currentAttended;
    setOptimisticAttended(newAttended);
    
    const weekNumber = getWeekNumber(selectedWeek);
    
    let attendanceData;
    if (newAttended) {
      // Mark as attended - create timestamp and center info
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const formattedHours = String(hours).padStart(2, '0');
      const lastAttendance = `${day}/${month}/${year} in ${attendanceCenter} at ${formattedHours}:${minutes} ${ampm}`;
      
      attendanceData = { 
        attended: true,
        lastAttendance, 
        lastAttendanceCenter: attendanceCenter, 
        attendanceWeek: weekNumber 
      };
    } else {
      // Mark as not attended - clear attendance info
      attendanceData = { 
        attended: false,
        lastAttendance: null, 
        lastAttendanceCenter: null, 
        attendanceWeek: weekNumber 
      };
    }
    
    console.log('🎯 Scan Page - Toggling attendance:', {
      studentId: student.id,
      studentName: student.name,
      newAttendedState: newAttended,
      weekNumber
    });

    toggleAttendanceMutation.mutate({
      id: student.id,
      attendanceData
    });
  };

  const toggleHwDone = async () => {
    if (!student || !selectedWeek || !attendanceCenter) return;
    
    // Check if student is attended - can't do homework if not attended
    const currentAttended = optimisticAttended !== null ? optimisticAttended : student.attended_the_session;
    if (!currentAttended) {
      setError("Student must be marked as attended before homework can be updated.");
      return;
    }
    
    // Use current displayed state (optimistic if available, otherwise DB state)
    const currentHwDone = optimisticHwDone !== null ? optimisticHwDone : student.hwDone;
    const newHwDone = !currentHwDone;
    setOptimisticHwDone(newHwDone);
    
    const weekNumber = getWeekNumber(selectedWeek);
    
    updateHomeworkMutation.mutate({
      id: student.id,
      homeworkData: { hwDone: newHwDone, week: weekNumber }
    });
  };

  const togglePaidSession = async () => {
    if (!student || !selectedWeek || !attendanceCenter) return;
    
    // Check if student is attended - can't pay if not attended
    const currentAttended = optimisticAttended !== null ? optimisticAttended : student.attended_the_session;
    if (!currentAttended) {
      setError("Student must be marked as attended before payment can be updated.");
      return;
    }
    
    // Use current displayed state (optimistic if available, otherwise DB state)
    const currentPaidSession = optimisticPaidSession !== null ? optimisticPaidSession : student.paidSession;
    const newPaidSession = !currentPaidSession;
    setOptimisticPaidSession(newPaidSession);
    
    const weekNumber = getWeekNumber(selectedWeek);
    
    updatePaymentMutation.mutate({
      id: student.id,
      paymentData: { paidSession: newPaidSession, week: weekNumber }
    });
  };

  // Add form handler for quiz degree
  const handleQuizFormSubmit = async (e) => {
    e.preventDefault();
    await handleQuizDegreeSubmit();
  };

  const handleQuizDegreeSubmit = async () => {
    if (!student || !selectedWeek || !attendanceCenter) return;
    if (quizDegreeInput === "" || quizDegreeOutOf === "") return;
    
    // Check if student is attended - can't enter quiz if not attended
    const currentAttended = optimisticAttended !== null ? optimisticAttended : student.attended_the_session;
    if (!currentAttended) {
      setError("Student must be marked as attended before quiz degree can be entered.");
      return;
    }
    
    const quizDegreeValue = `${quizDegreeInput} / ${quizDegreeOutOf}`;
    const weekNumber = getWeekNumber(selectedWeek);
    
    updateQuizGradeMutation.mutate({
      id: student.id,
      quizData: { quizDegree: quizDegreeValue, week: weekNumber }
    });
    
    // Clear inputs after submission
    setQuizDegreeInput("");
    setQuizDegreeOutOf("");
  };



  const goBack = () => {
    router.push("/dashboard");
  };

  return (
    <div style={{ 
      minHeight: "100vh",
      padding: "20px 5px 20px 5px",
    }}>
      <div ref={containerRef} style={{ maxWidth: 600, margin: "40px auto", padding: 24 }}>
      <style jsx>{`
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
        }
        .title {
          font-size: 2rem;
          font-weight: 700;
          color: #ffffff;
        }
        .back-btn {
          background: linear-gradient(90deg, #6c757d 0%, #495057 100%);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .back-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .input-section {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          margin-bottom: 24px;
        }
        .input-group {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .manual-input {
          flex: 1;
          padding: 14px 16px;
          border: 2px solid #e9ecef;
          border-radius: 10px;
          font-size: 1rem;
          transition: all 0.3s ease;
          background: #ffffff;
          color: #000000;
        }
        .manual-input:focus {
          outline: none;
          border-color: #87CEEB;
          background: white;
          box-shadow: 0 0 0 3px rgba(135, 206, 235, 0.1);
        }
        .fetch-btn {
          background: linear-gradient(135deg, #1FA8DC 0%, #87CEEB 100%);
          color: white;
          border: none;
          border-radius: 12px;
          padding: 16px 28px;
          font-weight: 700;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 16px rgba(31, 168, 220, 0.3);
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 140px;
          justify-content: center;
        }
        .fetch-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(31, 168, 220, 0.4);
          background: linear-gradient(135deg, #0d8bc7 0%, #5bb8e6 100%);
        }
        .fetch-btn:active {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(31, 168, 220, 0.3);
        }
        .fetch-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: 0 2px 8px rgba(31, 168, 220, 0.2);
        }
        .qr-container {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          margin-bottom: 24px;
        }
        .qr-reader {
          border-radius: 12px;
          overflow: hidden;
          color: #000000;
        }
        .qr-reader * {
          color: #000000 !important;
        }
        .error-message {
          background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%);
          color: white;
          border-radius: 10px;
          padding: 16px;
          margin-top: 16px;
          text-align: center;
          font-weight: 600;
          box-shadow: 0 4px 16px rgba(220, 53, 69, 0.3);
        }
        .student-card {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          border: 1px solid rgba(255,255,255,0.2);
        }
        .student-name {
          font-size: 1.5rem;
          font-weight: 700;
          color: #495057;
          margin-bottom: 16px;
          border-bottom: 2px solid #e9ecef;
          padding-bottom: 12px;
        }
        .student-info {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 30px;
        }
        .info-item {
          display: flex;
          flex-direction: column;
          background: #ffffff;
          padding: 20px;
          border-radius: 12px;
          border: 2px solid #e9ecef;
          border-left: 4px solid #1FA8DC;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          transition: all 0.3s ease;
        }
        .info-item.select-item {
          border-left: 2px solid #e9ecef;
        }
        .info-label {
          font-weight: 700;
          color: #6c757d;
          font-size: 0.85rem;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .info-value {
          color: #212529;
          font-size: 1.2rem;
          font-weight: 600;
          line-height: 1.4;
        }
        .status-row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 20px;
        }
        .status-badge {
          padding: 8px 16px;
          border-radius: 25px;
          font-weight: 600;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: fit-content;
          white-space: nowrap;
        }
        .status-attended {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
        }
        .status-not-attended {
          background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%);
          color: white;
        }
        .mark-attended-btn {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          border: none;
          border-radius: 10px;
          padding: 14px 24px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 16px rgba(40, 167, 69, 0.3);
          width: 100%;
        }
        .mark-attended-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(40, 167, 69, 0.4);
        }
        .success-message {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          border-radius: 10px;
          padding: 16px;
          margin-top: 16px;
          text-align: center;
          font-weight: 600;
          box-shadow: 0 4px 16px rgba(40, 167, 69, 0.3);
        }
        .mark-hw-btn {
          transition: background 0.2s, color 0.2s;
        }
        .select-styled {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e9ecef;
          border-radius: 10px;
          font-size: 1rem;
          background: #fff;
          color: #222;
          transition: border-color 0.2s, box-shadow 0.2s;
          margin-top: 4px;
          box-sizing: border-box;
        }
        .select-styled:focus {
          outline: none;
          border-color: #87CEEB;
          box-shadow: 0 0 0 3px rgba(135, 206, 235, 0.1);
        }
        .quiz-row {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-top: 10px;
          margin-bottom: 16px;
          width: 100%;
        }
        .quiz-input {
          width: 40%;
          min-width: 0;
        }
        .quiz-btn {
          width: 20%;
          min-width: 70px;
          padding-left: 0;
          padding-right: 0;
        }
        .quiz-inputs-container {
          display: flex;
          gap: 8px;
          width: 80%;
        }
        @media (max-width: 600px) {
          .quiz-row {
            flex-direction: column;
            gap: 8px;
          }
          .quiz-input, .quiz-btn {
            width: 100%;
          }
          .quiz-inputs-container {
            display: flex;
            gap: 8px;
            width: 100%;
          }
          .quiz-input {
            width: 50%;
          }
        }
        @media (max-width: 768px) {
          .student-info {
            gap: 12px;
          }
          .status-row {
            flex-direction: column;
            gap: 8px;
          }
          .status-badge {
            justify-content: center;
            width: 100%;
          }
          .info-item {
            padding: 16px;
          }
          .info-value {
            font-size: 1rem;
          }
          .input-group {
            flex-direction: column;
            gap: 12px;
          }
          .fetch-btn {
            width: 100%;
            padding: 14px 20px;
            font-size: 0.95rem;
          }
          .manual-input {
            width: 100%;
          }
        }
        @media (max-width: 480px) {
          .student-info {
            gap: 10px;
          }
          .info-item {
            padding: 14px;
          }
          .info-label {
            font-size: 0.8rem;
          }
          .info-value {
            font-size: 0.95rem;
          }
          .status-badge {
            font-size: 0.8rem;
            padding: 6px 12px;
          }
        }
      `}</style>

             <Title>QR Code Scanner</Title>

      <div className="input-section">
        <form onSubmit={handleManualSubmit} className="input-group">
                  <input
          className="manual-input"
          type="text"
          placeholder="Enter student ID (e.g., 1)"
          value={studentId}
          onChange={(e) => {
            setStudentId(e.target.value);
            setSearchId(""); // Clear search ID to prevent auto-fetch
            // Clear error and success when ID changes
            if (e.target.value !== studentId) {
              setError("");
              setAttendSuccess(false);
            }
          }}
        />
          <button type="submit" className="fetch-btn">
            🔍 Search
          </button>
        </form>
      </div>

      <div className="qr-container">
        <div id="qr-reader" className="qr-reader"></div>
      </div>

      {student && (
        <div className="student-card">
          <div className="student-name">{student.name}</div>
                  
          <div className="student-info">
              {student.grade && (
              <div className="info-item">
                <span className="info-label">Grade</span>
                <span className="info-value">{student.grade}</span>
              </div>
              )}
            {student.main_center && (
            <div className="info-item">
              <span className="info-label">Main Center</span>
              <span className="info-value">{student.main_center}</span>
            </div>
            )}
            {student.school && (
            <div className="info-item">
              <span className="info-label">School</span>
              <span className="info-value">{student.school}</span>
            </div>
            )}
          </div>

          <div className="status-row">
            <span className={`status-badge ${(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) ? 'status-attended' : 'status-not-attended'}`}>
              {(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) ? '✅ Attended' : '❌ Not Attended'}
            </span>
            <span className={`status-badge ${(optimisticHwDone !== null ? optimisticHwDone : student.hwDone) ? 'status-attended' : 'status-not-attended'}`}>
              {(optimisticHwDone !== null ? optimisticHwDone : student.hwDone) ? '✅ H.W: Done' : '❌ H.W: Not Done'}
            </span>
            <span className={`status-badge ${(optimisticPaidSession !== null ? optimisticPaidSession : student.paidSession) ? 'status-attended' : 'status-not-attended'}`}>
              {(optimisticPaidSession !== null ? optimisticPaidSession : student.paidSession) ? '✅ Paid' : '❌ Not Paid'}
            </span>
            <span className={`status-badge ${student.quizDegree ? 'status-attended' : 'status-not-attended'}`}>
              {student.quizDegree ? `✅ Quiz: ${student.quizDegree}` : '❌ Quiz: ...'}
            </span>
          </div>

          {/* Show current attendance info if student is attended */}
          {(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) && student.lastAttendance && (
            <div className="info-item">
              <div className="info-label">Current Attendance:</div>
              <div className="info-value" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                {student.lastAttendance}
              </div>
            </div>
          )}
          
          {/* Attendance Center - always show for all students */}
          <div className="info-item select-item" style={{ marginBottom: 16 }}>
            <div className="info-label">Attendance Center</div>
            <CenterSelect
              selectedCenter={attendanceCenter}
              onCenterChange={(center) => {
                setAttendanceCenter(center);
                // Remember the selected center
                if (center) {
                  sessionStorage.setItem('lastAttendanceCenter', center);
                } else {
                  // Clear selection - remove from sessionStorage
                  sessionStorage.removeItem('lastAttendanceCenter');
                }
              }}
            />
          </div>
          
          {/* Attendance Week - always show for both attended and non-attended students */}
          <div className="info-item select-item" style={{ marginBottom: 16 }}>
            <div className="info-label">Attendance Week</div>
            <AttendanceWeekSelect
              selectedWeek={selectedWeek}
              onWeekChange={(week) => {
                console.log('Week selected:', week);
                setSelectedWeek(week);
                if (week) {
                  updateAttendanceWeek(week);
                } else {
                  // Clear selection - remove from sessionStorage
                  sessionStorage.removeItem('lastSelectedWeek');
                }
              }}
              required={true}
            />
          </div>

          {/* Warning message when week/center not selected */}
          {(!selectedWeek || !attendanceCenter) && (
            <div style={{
              background: 'linear-gradient(135deg, #ffc107 0%, #ffb74d 100%)',
              color: 'white',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 8,
              textAlign: 'center',
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(255, 193, 7, 0.3)',
              fontSize: '0.9rem'
            }}>
              ⚠️ Please select both a week and attendance center to enable tracking
            </div>
          )}

          {/* Simple toggle buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            
            {/* Attendance Toggle Button - Always visible */}
            <button
              className="toggle-btn"
              onClick={toggleAttendance}
              disabled={!attendanceCenter || !selectedWeek}
              style={{
                width: '100%',
                background: (optimisticAttended !== null ? optimisticAttended : student.attended_the_session) ? 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)' : 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontWeight: 600,
                fontSize: '1.1rem',
                padding: '14px 0',
                cursor: (!attendanceCenter || !selectedWeek) ? 'not-allowed' : 'pointer',
                opacity: (!attendanceCenter || !selectedWeek) ? 0.5 : 1,
                transition: 'all 0.3s ease'
              }}
            >
              {(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) ? '❌ Mark as Not Attended' : '✅ Mark as Attended'}
            </button>

            {/* Homework Toggle Button */}
            <button
              className="toggle-btn"
              onClick={toggleHwDone}
              disabled={!attendanceCenter || !selectedWeek || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)}
              style={{
                width: '100%',
                background: !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) 
                  ? 'linear-gradient(135deg, #6c757d 0%, #495057 100%)' // Gray when not attended
                  : (optimisticHwDone !== null ? optimisticHwDone : student.hwDone) 
                    ? 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)' 
                    : 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontWeight: 600,
                fontSize: '1.1rem',
                padding: '14px 0',
                cursor: (!attendanceCenter || !selectedWeek || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 'not-allowed' : 'pointer',
                opacity: (!attendanceCenter || !selectedWeek || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 0.5 : 1,
                transition: 'all 0.3s ease'
              }}
            >
              {!(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) 
                ? '🚫 Must Attend First' 
                : (optimisticHwDone !== null ? optimisticHwDone : student.hwDone) 
                  ? '❌ Mark as H.W Not Done' 
                  : '✅ Mark as H.W Done'}
            </button>

            {/* Payment Toggle Button */}
            <button
              className="toggle-btn"
              onClick={togglePaidSession}
              disabled={!attendanceCenter || !selectedWeek || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)}
              style={{
                width: '100%',
                background: !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) 
                  ? 'linear-gradient(135deg, #6c757d 0%, #495057 100%)' // Gray when not attended
                  : (optimisticPaidSession !== null ? optimisticPaidSession : student.paidSession) 
                    ? 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)' 
                    : 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontWeight: 600,
                fontSize: '1.1rem',
                padding: '14px 0',
                cursor: (!attendanceCenter || !selectedWeek || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 'not-allowed' : 'pointer',
                opacity: (!attendanceCenter || !selectedWeek || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 0.5 : 1,
                transition: 'all 0.3s ease'
              }}
            >
              {!(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) 
                ? '🚫 Must Attend First' 
                : (optimisticPaidSession !== null ? optimisticPaidSession : student.paidSession) 
                  ? '❌ Mark as Not Paid' 
                  : '✅ Mark as Paid'}
            </button>

          </div>

          {/* Quiz degree input section */}
          <div className="info-label" style={{ marginBottom: 6, marginTop: 10, textAlign: 'start', fontWeight: 600 }}>
            Quiz Degree
          </div>
          <form onSubmit={handleQuizFormSubmit} className="quiz-row">
            <div className="quiz-inputs-container">
            <input
              type="number"
              step="any"
              min="0"
              className="manual-input quiz-input"
              placeholder={
                (!selectedWeek || !attendanceCenter) ? "Select week and center first..." 
                : !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) ? "Must attend first..."
                : "degree ..."
              }
              value={quizDegreeInput}
              onChange={e => setQuizDegreeInput(e.target.value)}
              disabled={updateQuizGradeMutation.isPending || !selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)}
              style={{
                opacity: (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 0.5 : 1,
                cursor: (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 'not-allowed' : 'text'
              }}
            />
            <input
              type="number"
              step="any"
              min="0"
              className="manual-input quiz-input"
              placeholder={
                (!selectedWeek || !attendanceCenter) ? "Select week and center first..." 
                : !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) ? "Must attend first..."
                : "out of ..."
              }
              value={quizDegreeOutOf}
              onChange={e => setQuizDegreeOutOf(e.target.value)}
              disabled={updateQuizGradeMutation.isPending || !selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)}
              style={{
                opacity: (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 0.5 : 1,
                cursor: (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 'not-allowed' : 'text'
              }}
            />
            </div>
            <button
              type="submit"
              className="fetch-btn quiz-btn"
              disabled={updateQuizGradeMutation.isPending || quizDegreeInput === "" || quizDegreeOutOf === "" || !selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)}
              style={{
                opacity: (!selectedWeek || !attendanceCenter || quizDegreeInput === "" || quizDegreeOutOf === "" || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 0.5 : 1,
                cursor: (!selectedWeek || !attendanceCenter || quizDegreeInput === "" || quizDegreeOutOf === "" || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease'
              }}
              title={
                !selectedWeek ? 'Please select a week first' 
                : !attendanceCenter ? 'Please select an attendance center first' 
                : !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) ? 'Student must attend first'
                : (quizDegreeInput === "" || quizDegreeOutOf === "") ? 'Please fill both fields' 
                : ''
              }
            >
              {updateQuizGradeMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </form>
        </div>
      )}



      {/* Error message now appears below the student card */}
      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}
      </div>
    </div>
  );
}