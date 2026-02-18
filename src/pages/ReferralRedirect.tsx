import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function ReferralRedirect() {
  const { code } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (code) {
      localStorage.setItem("referralCode", code);
    }
    navigate(`/register?ref=${encodeURIComponent(code || "")}`, { replace: true });
  }, [code, navigate]);

  return null;
}
