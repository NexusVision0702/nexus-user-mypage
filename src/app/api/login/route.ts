import { NextResponse } from 'next/server';
import { docClient, USERS_TABLE } from '../../../lib/dynamodb';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'メールアドレスとパスワードを入力してください。' }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const queryCommand = new QueryCommand({
      TableName: USERS_TABLE,
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': trimmedEmail },
    });
    const queryResult = await docClient.send(queryCommand);

    if (!queryResult.Items || queryResult.Items.length === 0) {
      return NextResponse.json({ error: '入力されたメールアドレスのユーザーが見つかりません。' }, { status: 401 });
    }

    const userData = queryResult.Items[0] as any;

    // 1. ステータスが 'active'（本登録済み）かどうかをチェック
    if (userData.status !== 'active') {
      return NextResponse.json(
        { error: '本登録が完了していません。メールの認証リンクから本登録を完了させてください。' },
        { status: 403 }
      );
    }

    // 2. パスワードの安全な照合（Bcryptjs）
    const isPasswordValid = await bcrypt.compare(password, userData.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'パスワードが間違っています。' }, { status: 401 });
    }

    return NextResponse.json({ success: true, uid: userData.uid });
  } catch (error: any) {
    console.error('Login API error:', error);
    return NextResponse.json({ error: error.message || 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}