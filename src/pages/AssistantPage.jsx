import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAssistant } from '../context/AssistantContext';
export default function AssistantPage() {
  const { openAssistant } = useAssistant();
  const navigate = useNavigate();
  useEffect(() => { openAssistant(); navigate('/dashboard', { replace: true }); }, [openAssistant, navigate]);
  return null;
}
