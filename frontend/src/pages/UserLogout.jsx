import React, { useEffect } from "react";
import axios from "axios";
import { getApiBaseUrl } from "../apiBase";
import { useNavigate } from "react-router-dom";
const UserLogout = () => {
  const Navigate = useNavigate();
  const token = localStorage.getItem("token");
  useEffect(() => {
    const run = async () => {
      try {
        await axios.get(`${getApiBaseUrl()}/users/logout`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        /* still clear session locally */
      }
      localStorage.removeItem("token");
      Navigate("/login");
    };
    run();
  }, [Navigate, token]);
  return <div>UserLogout</div>;
};

export default UserLogout;
