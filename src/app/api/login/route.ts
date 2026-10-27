import { NextResponse } from 'next/server';
import { docClient, USERS_TABLE } from '../../../lib/dynamodb';
import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
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
    const now = new Date();

    // 1. アカウントロック状態の確認
    if (userData.lockUntil && new Date(userData.lockUntil) > now) {
      const remainingMinutes = Math.ceil((new Date(userData.lockUntil).getTime() - now.getTime()) / 60000);
      return NextResponse.json({ 
        error: `パスワードの連続失敗によりアカウントがロックされています。約 ${remainingMinutes} 分後にお試しください。` 
      }, { status: 403 });
    }

    // 2. ステータスが 'active'（本登録済み）かどうかをチェック
    if (userData.status !== 'active') {
      return NextResponse.json(
        { error: '本登録が完了していません。メールの認証リンクから本登録を完了させてください。' },
        { status: 403 }
      );
    }

    // 3. パスワードの安全な照合（Bcryptjs ＆ 平文フォールバック対応）
    let isPasswordValid = false;
    if (userData.password) {
      if (userData.password.startsWith('$2b$') || userData.password.startsWith('$2a$')) {
        isPasswordValid = await bcrypt.compare(password, userData.password);
      } else {
        isPasswordValid = (password === userData.password);
      }
    }

    // 4. パスワード不一致時の処理（連続失敗でカウントアップ＆ロック）
    if (!isPasswordValid) {
      const failedCount = (userData.loginFailedCount || 0) + 1;
      const MAX_ATTEMPTS = 5; // 最大5回まで
      
      let updateExpr = 'SET loginFailedCount = :count';
      let exprValues: any = { ':count': failedCount };

      if (failedCount >= MAX_ATTEMPTS) {
        // 5回連続失敗で15分間ロック
        const lockUntilDate = new Date(now.getTime() + 15 * 60000).toISOString();
        updateExpr += ', lockUntil = :lockUntil';
        exprValues[':lockUntil'] = lockUntilDate;

        await docClient.send(new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { email: trimmedEmail }, // テーブルのプライマリキーに合わせて調整
          UpdateExpression: updateExpr,
          ExpressionAttributeValues: exprValues,
        }));

        return NextResponse.json({ 
          error: `パスワードを ${MAX_ATTEMPTS} 回連続で間違えたため、セキュリティ保護のためアカウントを15分間ロックしました。` 
        }, { status: 403 });
      } else {
        // 失敗回数を更新して残り回数を通知
        await docClient.send(new UpdateCommand({
          TableName: USERS_TABLE,
          Key: { email: trimmedEmail },
          UpdateExpression: updateExpr,
          ExpressionAttributeValues: exprValues,
        }));

        const remaining = MAX_ATTEMPTS - failedCount;
        return NextResponse.json({ 
          error: `パスワードが間違っています。（あと ${remaining} 回間違えるとロックされます）` 
        }, { status: 401 });
      }
    }

    // 5. ログイン成功時：失敗回数とロック情報をリセット
    if ((userData.loginFailedCount || 0) > 0 || userData.lockUntil) {
      await docClient.send(new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { email: trimmedEmail },
        UpdateExpression: 'SET loginFailedCount = :zero REMOVE lockUntil',
        ExpressionAttributeValues: { ':zero': 0 },
      }));
    }

    return NextResponse.json({ success: true, uid: userData.uid || trimmedEmail });
  } catch (error: any) {
    console.error('Login API error:', error);
    return NextResponse.json({ error: error.message || 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}