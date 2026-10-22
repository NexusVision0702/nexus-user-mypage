import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// Resendの初期化（環境変数からAPIキーを読み込みます）
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and code are required' },
        { status: 400 }
      );
    }

    // Resendを使ったメール送信処理
    const data = await resend.emails.send({
      from: 'support@nexus-vision.net', // ご指定の送信元アドレス
      to: [email],
      subject: '【ネクビジョ】2段階認証コード',
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #2e7d32;">2段階認証のご案内</h2>
          <p>ログインに必要な認証コードを発行いたしました。</p>
          <div style="background-color: #f4f4f4; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center; margin: 20px 0;">
            ${code}
          </div>
          <p>このコードの有効期限は10分です。</p>
          <p>心当たりがない場合は、このメールを無視してください。</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Failed to send email:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}