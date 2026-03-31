import React, { useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
const CaptainLogout = () => {
  const Navigate = useNavigate();
  const token = localStorage.getItem("token");
  useEffect(() => {
    const run = async () => {
      try {
        await axios.get(`${import.meta.env.VITE_BASE_URL}/captain/logout`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        /* still clear session locally */
      }
      localStorage.removeItem("token");
      Navigate("/captain-login");
    };
    run();
  }, [Navigate, token]);
  return <div>CaptainLogout</div>;
};

export default CaptainLogout;
