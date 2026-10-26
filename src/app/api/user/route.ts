import { NextResponse } from 'next/server';
import { docClient, USERS_TABLE } from '../../../lib/dynamodb';
import { GetCommand, PutCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import bcrypt from 'bcryptjs'; // または 'bcrypt'

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
    const fullAddress = `〒${formData.postalCode} ${formData.prefecture}${formData.city}${formData.addressLine} ${formData.building}`.trim();
    const fullName = `${formData.lastName || ''} ${formData.firstName || ''}`.trim();
    const fullKana = `${formData.lastNameKana || ''} ${formData.firstNameKana || ''}`.trim();

    // 1. 既存のユーザーデータを取得
    const getCommand = new GetCommand({
      TableName: USERS_TABLE,
      Key: { email: oldEmail },
    });
    const existingRes = await docClient.send(getCommand);
    const existingUser = existingRes.Item || {};

    // 2. パスワードの処理（変更がある場合は必ずハッシュ化する）
    let passwordToSave = existingUser.password || '';
    if (formData.newPassword) {
      if (formData.newPassword.length < 6) {
        return NextResponse.json({ error: 'パスワードは6文字以上で入力してください。' }, { status: 400 });
      }
      // ★ ここで平文ではなく確実にハッシュ化する
      const salt = await bcrypt.genSalt(10);
      passwordToSave = await bcrypt.hash(formData.newPassword, salt);
    }

    // 3. 新しいメールアドレス（または更新後）でデータを保存（Put）
    const putCommand = new PutCommand({
      TableName: USERS_TABLE,
      Item: {
        ...existingUser,
        email: newEmail,
        name: fullName,
        furigana: fullKana,
        lastName: formData.lastName,
        firstName: formData.firstName,
        lastNameKana: formData.lastNameKana,
        firstNameKana: formData.firstNameKana,
        birthdate: formData.birthdate,
        phone: formData.phone,
        postalCode: formData.postalCode,
        prefecture: formData.prefecture,
        city: formData.city,
        addressLine: formData.addressLine,
        building: formData.building,
        address: fullAddress,
        password: passwordToSave,
        status: 'active', // ステータスを確実に active に設定
        updatedAt: new Date().toISOString(),
      },
    });
    await docClient.send(putCommand);

    // 4. メールアドレス（主キー）が変更されていた場合、古いレコードを削除
    if (oldEmail !== newEmail) {
      const deleteCommand = new DeleteCommand({
        TableName: USERS_TABLE,
        Key: { email: oldEmail },
      });
      await docClient.send(deleteCommand);
    }

    return NextResponse.json({ success: true, message: '更新成功しました' });
  } catch (error: any) {
    console.error('Update User API error:', error);
    return NextResponse.json({ error: error.message || 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}