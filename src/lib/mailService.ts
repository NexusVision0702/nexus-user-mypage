// Firestoreを使わず、Next.jsのAPIルート経由でResendに送信するサービス
export async function sendVerificationEmail(email: string, code: string): Promise<void> {
  const response = await fetch('/api/send-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, code }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to send verification email');
  }
}