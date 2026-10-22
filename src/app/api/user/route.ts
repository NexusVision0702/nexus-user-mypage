import { NextResponse } from 'next/server';
import { docClient, USERS_TABLE } from '../../../lib/dynamodb';
import { GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

// ユーザー情報取得 (GET)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const uidOrEmail = searchParams.get('uid');

    if (!uidOrEmail) {
      return NextResponse.json({ error: 'uidが指定されていません。' }, { status: 400 });
    }

    let command = new GetCommand({
      TableName: USERS_TABLE,
      Key: { uid: uidOrEmail },
    });
    let response = await docClient.send(command);

    let data: any = response.Item || null;
    if (!data) {
      const queryCommand = new QueryCommand({
        TableName: USERS_TABLE,
        IndexName: 'email-index',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: { ':email': uidOrEmail },
      });
      const queryResult = await docClient.send(queryCommand);
      if (queryResult.Items && queryResult.Items.length > 0) {
        data = queryResult.Items[0];
      }
    }

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

    if (!uid || !formData) {
      return NextResponse.json({ error: '必要なデータが不足しています。' }, { status: 400 });
    }

    const fullAddress = `〒${formData.postalCode} ${formData.prefecture}${formData.city}${formData.addressLine} ${formData.building}`.trim();

    const updateExpressionParts = [
      'lastName = :lastName',
      'firstName = :firstName',
      'lastNameKana = :lastNameKana',
      'firstNameKana = :firstNameKana',
      'birthdate = :birthdate',
      'phone = :phone',
      'postalCode = :postalCode',
      'prefecture = :prefecture',
      'city = :city',
      'addressLine = :addressLine',
      'building = :building',
      'address = :address',
      'email = :email',
      'updatedAt = :updatedAt'
    ];

    const expressionAttributeValues: any = {
      ':lastName': formData.lastName,
      ':firstName': formData.firstName,
      ':lastNameKana': formData.lastNameKana,
      ':firstNameKana': formData.firstNameKana,
      ':birthdate': formData.birthdate,
      ':phone': formData.phone,
      ':postalCode': formData.postalCode,
      ':prefecture': formData.prefecture,
      ':city': formData.city,
      ':addressLine': formData.addressLine,
      ':building': formData.building,
      ':address': fullAddress,
      ':email': formData.email.trim().toLowerCase(),
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
      Key: { uid },
      UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
    });

    await docClient.send(command);

    return NextResponse.json({ success: true, message: '更新成功しました' });
  } catch (error: any) {
    console.error('Update User API error:', error);
    return NextResponse.json({ error: error.message || 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}