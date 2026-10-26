import { NextResponse } from 'next/server';
import { docClient, USERS_TABLE } from '../../../lib/dynamodb';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

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

    const targetEmail = formData.email.trim().toLowerCase();
    const fullAddress = `〒${formData.postalCode} ${formData.prefecture}${formData.city}${formData.addressLine} ${formData.building}`.trim();

    // 姓と名を結合してDynamoDBの name / furigana 属性に合わせる
    const fullName = `${formData.lastName || ''} ${formData.firstName || ''}`.trim();
    const fullKana = `${formData.lastNameKana || ''} ${formData.firstNameKana || ''}`.trim();

    const updateExpressionParts = [
      '#n = :name',
      'furigana = :furigana',
      'birthdate = :birthdate',
      'phone = :phone',
      'postalCode = :postalCode',
      'prefecture = :prefecture',
      'city = :city',
      'addressLine = :addressLine',
      'building = :building',
      'address = :address',
      'updatedAt = :updatedAt'
    ];

    // DynamoDBの予約語である "name" を回避するためのエイリアス
    const expressionAttributeNames: any = {
      '#n': 'name',
    };

    const expressionAttributeValues: any = {
      ':name': fullName,
      ':furigana': fullKana,
      ':birthdate': formData.birthdate,
      ':phone': formData.phone,
      ':postalCode': formData.postalCode,
      ':prefecture': formData.prefecture,
      ':city': formData.city,
      ':addressLine': formData.addressLine,
      ':building': formData.building,
      ':address': fullAddress,
      ':updatedAt': new Date().toISOString(),
    };

    if (formData.newPassword) {
      if (formData.newPassword.length < 6) {
        return NextResponse.json({ error: 'パスワードは6文字以上で入力してください。' }, { status: 400 });
      }
      updateExpressionParts.push('password = :password');
      expressionAttributeValues[':password'] = formData.newPassword;
    }

    const command = new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { email: targetEmail },
      UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    });

    await docClient.send(command);

    return NextResponse.json({ success: true, message: '更新成功しました' });
  } catch (error: any) {
    console.error('Update User API error:', error);
    return NextResponse.json({ error: error.message || 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}