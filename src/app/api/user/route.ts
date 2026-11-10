import { NextResponse } from 'next/server';
import { docClient, USERS_TABLE } from '../../../lib/dynamodb';
import { GetCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import bcrypt from 'bcryptjs';

// ユーザー情報取得 (GET)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const emailOrUid = searchParams.get('uid');

    if (!emailOrUid) {
      return NextResponse.json({ error: 'メールアドレスが指定されていません。' }, { status: 400 });
    }

    const command = new GetCommand({
      TableName: USERS_TABLE,
      Key: { email: emailOrUid.trim().toLowerCase() },
    });
    const response = await docClient.send(command);

    const data = response.Item || null;
    if (!data) {
      return NextResponse.json({ error: 'ユーザーが見つかりません。' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: data });
  } catch (error: any) {
    console.error('Get User API error:', error);
    return NextResponse.json({ error: error.message || 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}

// ユーザー情報更新 (POST)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { uid, formData } = body;

    if (!formData || !formData.email) {
      return NextResponse.json({ error: '必要なデータが不足しています。' }, { status: 400 });
    }

    const oldEmail = (uid || formData.email).trim().toLowerCase();
    const newEmail = formData.email.trim().toLowerCase();

    // 1. 既存のユーザーデータを取得
    const getCommand = new GetCommand({
      TableName: USERS_TABLE,
      Key: { email: oldEmail },
    });
    const existingRes = await docClient.send(getCommand);
    const existingUser = existingRes.Item || {};

    // 2. パスワードの処理
    let passwordToSave = existingUser.password || '';
    if (formData.newPassword) {
      if (formData.newPassword.length < 6) {
        return NextResponse.json({ error: 'パスワードは6文字以上で入力してください。' }, { status: 400 });
      }
      const salt = await bcrypt.genSalt(10);
      passwordToSave = await bcrypt.hash(formData.newPassword, salt);
    }

    // 3. UpdateCommand を使って必要な項目だけをピンポイントで更新
    const updateCommand = new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { email: oldEmail },
      UpdateExpression: `
        SET #name = :name,
            #furigana = :furigana,
            #birthdate = :birthdate,
            #gender = :gender,
            #phone = :phone,
            #address = :address,
            #password = :password,
            #updatedAt = :updatedAt
      `,
      ExpressionAttributeNames: {
        '#name': 'name',
        '#furigana': 'furigana',
        '#birthdate': 'birthdate',
        '#gender': 'gender',
        '#phone': 'phone',
        '#address': 'address',
        '#password': 'password',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':name': formData.name || existingUser.name || '',
        ':furigana': formData.furigana || existingUser.furigana || '',
        ':birthdate': formData.birthdate || existingUser.birthdate || '',
        ':gender': formData.gender !== undefined ? formData.gender : (existingUser.gender || ''),
        ':phone': formData.phone || existingUser.phone || '',
        ':address': formData.address || existingUser.address || '',
        ':password': passwordToSave,
        ':updatedAt': new Date().toISOString(),
      },
    });

    await docClient.send(updateCommand);

    return NextResponse.json({ success: true, message: '更新成功しました' });
  } catch (error: any) {
    console.error('Update User API error:', error);
    return NextResponse.json({ error: error.message || 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}