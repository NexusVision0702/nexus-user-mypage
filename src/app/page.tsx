'use client';

import React, { useState, useEffect } from 'react';

export default function UserLoginPage() {
  const [step, setStep] = useState<'login' | 'mfa' | 'dashboard' | 'confirm' | 'email_mfa' | 'forgot_password' | 'forgot_reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);

  // パスワードリセット用
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotTargetDocId, setForgotTargetDocId] = useState<string | null>(null);
  const [newPasswordReset, setNewPasswordReset] = useState('');
  const [confirmPasswordReset, setConfirmPasswordReset] = useState('');

  const emptyData = {
    lastName: '',
    firstName: '',
    lastNameKana: '',
    firstNameKana: '',
    birthdate: '',
    phone: '',
    postalCode: '',
    prefecture: '',
    city: '',
    addressLine: '',
    building: '',
    address: '',
    email: '',
    currentPasswordForAuth: '',
    newPassword: '',
    confirmPassword: '',
  };

  const [initialData, setInitialData] = useState(emptyData);
  const [formData, setFormData] = useState(emptyData);
  const [updateMessage, setUpdateMessage] = useState('');
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // ★ 日本語の生年月日（例: "1999年7月25日"）を date input 用（"1999-07-25"）に変換するヘルパー
  const parseBirthdate = (dateStr: string) => {
    if (!dateStr) return '';
    const match = dateStr.match(/([0-9]{4})年([0-9]{1,2})月([0-9]{1,2})日/);
    if (match) {
      const y = match[1];
      const m = match[2].padStart(2, '0');
      const d = match[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return dateStr; // すでに "YYYY-MM-DD" の場合など
  };

  useEffect(() => {
    const fetchUserData = async () => {
      if (step === 'dashboard' && currentUserUid && !isDataLoaded) {
        try {
          const res = await fetch(`/api/user?uid=${encodeURIComponent(currentUserUid)}`);
          const result = await res.json();
          if (!res.ok) {
            throw new Error(result.error || 'データ取得に失敗しました');
          }

          const data = result.user;
          if (data) {
            const nameParts = (data.name || '').split(/[\s ]+/);
            const lName = data.lastName || nameParts[0] || '';
            const fName = data.firstName || nameParts[1] || '';

            const kanaParts = (data.furigana || '').split(/[\s ]+/);
            const lNameKana = data.lastNameKana || kanaParts[0] || '';
            const fNameKana = data.firstNameKana || kanaParts[1] || '';

            let pCode = data.postalCode || '';
            let pref = data.prefecture || '';
            let cty = data.city || '';
            let aLine = data.addressLine || '';
            let bldg = data.building || '';

            if (!pCode && data.address) {
              const match = data.address.match(/〒?([0-9]{3}-?[0-9]{4})\s*(.*)/);
              if (match) {
                pCode = match[1].replace('-', '');
                const rest = match[2];
                const prefMatch = rest.match(/^(東京都|北海道|大阪府|京都府|.{2,3}県)(.+)/);
                if (prefMatch) {
                  pref = prefMatch[1];
                  const cityAndRest = prefMatch[2];
                  const cityMatch = cityAndRest.match(/^(.+?[市町村区])(.+)/);
                  if (cityMatch) {
                    cty = cityMatch[1];
                    aLine = cityMatch[2].trim();
                  } else {
                    aLine = cityAndRest;
                  }
                } else {
                  aLine = rest;
                }
              } else {
                aLine = data.address;
              }
            }

            const loadedData = {
              lastName: lName,
              firstName: fName,
              lastNameKana: lNameKana,
              firstNameKana: fNameKana,
              birthdate: parseBirthdate(data.birthdate || ''),
              phone: data.phone || '',
              postalCode: pCode,
              prefecture: pref,
              city: cty,
              addressLine: aLine,
              building: bldg,
              address: data.address || '',
              email: data.email || '',
              currentPasswordForAuth: '',
              newPassword: '',
              confirmPassword: '',
            };
            
            setInitialData(loadedData);
            setFormData(loadedData);
            setIsDataLoaded(true);
          }
        } catch (error: any) {
          console.error('データ取得エラー:', error);
        }
      }
    };

    fetchUserData();
  }, [step, currentUserUid, isDataLoaded]);

  const fieldLabels: { [key: string]: string } = {
    lastName: 'お名前 (姓)',
    firstName: 'お名前 (名)',
    lastNameKana: 'フリガナ (セイ)',
    firstNameKana: 'フリガナ (メイ)',
    birthdate: '生年月日',
    phone: '電話番号',
    postalCode: '郵便番号',
    prefecture: '都道府県',
    city: '市区町村・町域',
    addressLine: 'それ以降の住所',
    building: '建物名・部屋番号',
    email: 'メールアドレス (ログインID)',
    newPassword: 'パスワード',
  };

  const isFieldChanged = (key: keyof typeof formData) => {
    if (key === 'newPassword' || key === 'confirmPassword') {
      return formData.newPassword !== '';
    }
    return String(formData[key] ?? '').trim() !== String(initialData[key] ?? '').trim();
  };

  const getInputStyle = (key: keyof typeof formData) => {
    const changed = isFieldChanged(key);
    return {
      width: '100%',
      padding: '12px 14px',
      border: changed ? '2px solid #16a34a' : '1.5px solid #e2e8f0',
      borderRadius: '10px',
      background: changed ? '#f0fdf4' : '#f8fafc',
      color: '#0f172a',
      outline: 'none',
      boxSizing: 'border-box' as const,
      transition: 'all 0.2s ease',
    };
  };

  const handlePostalCodeChange = async (val: string) => {
    const cleanVal = val.replace(/[^0-9]/g, '').slice(0, 7);
    setFormData(prev => ({ ...prev, postalCode: cleanVal }));

    if (cleanVal.length === 7) {
      try {
        const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${cleanVal}`);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const result = data.results[0];
          setFormData(prev => ({
            ...prev,
            postalCode: cleanVal,
            prefecture: result.address1 || '',
            city: (result.address2 || '') + (result.address3 || ''),
          }));
        }
      } catch (e) {
        console.error('住所自動取得エラー', e);
      }
    }
  };

  const handlePhoneChange = (val: string) => {
    const numbers = val.replace(/[^0-9]/g, '');
    let formatted = numbers;
    if (numbers.length > 3 && numbers.length <= 7) {
      formatted = `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    } else if (numbers.length > 7) {
      formatted = `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    }
    setFormData(prev => ({ ...prev, phone: formatted }));
  };

  const targetKeys = ['lastName', 'firstName', 'lastNameKana', 'firstNameKana', 'birthdate', 'phone', 'postalCode', 'prefecture', 'city', 'addressLine', 'building', 'email', 'newPassword'];

  const isModified = targetKeys.some(key => isFieldChanged(key as keyof typeof formData));

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setErrorMessage('');

    try {
      const trimmedEmail = email.trim().toLowerCase();
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'ログインに失敗しました');
      }

      setCurrentUserUid(trimmedEmail);

      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedCode(verificationCode);

      const emailRes = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, code: verificationCode }),
      });

      const emailResult = await emailRes.json();
      if (!emailRes.ok) {
        throw new Error(emailResult.error || 'メール送信に失敗しました');
      }

      setStep('mfa');
    } catch (err: any) {
      setErrorMessage(`エラーが発生しました: ${err.message || '不明なエラー'}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyMfa = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setErrorMessage('');

    setTimeout(() => {
      // ★ セキュリティ修正: 固定コード '123456' を排除し、正当な generatedCode のみ許可
      if (inputCode === generatedCode) { 
        setStep('dashboard');
        setIsDataLoaded(false);
      } else {
        setErrorMessage('認証コードが間違っています。');
      }
      setAuthLoading(false);
    }, 500);
  };

  const handleSendForgotCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setErrorMessage('');

    try {
      const trimmedForgotEmail = forgotEmail.trim().toLowerCase();
      const resUser = await fetch(`/api/user?uid=${encodeURIComponent(trimmedForgotEmail)}`);
      const resultUser = await resUser.json();

      if (!resUser.ok || !resultUser.user) {
        throw new Error('登録されていないメールアドレスです。');
      }

      setForgotTargetDocId(resultUser.user.email);

      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedCode(verificationCode);
      setInputCode('');

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedForgotEmail, code: verificationCode }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'メール送信に失敗しました');
      }

      setStep('forgot_reset');
    } catch (err: any) {
      setErrorMessage(`エラー: ${err.message}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // ★ セキュリティ修正: 固定コード '123456' を排除
    if (inputCode !== generatedCode) {
      setErrorMessage('認証コードが間違っています。');
      return;
    }

    if (newPasswordReset.length < 6) {
      setErrorMessage('新しいパスワードは6文字以上で入力してください。');
      return;
    }

    if (newPasswordReset !== confirmPasswordReset) {
      setErrorMessage('新しいパスワードが一致しません。');
      return;
    }

    if (!forgotTargetDocId) return;

    try {
      setAuthLoading(true);
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: forgotTargetDocId,
          formData: {
            ...initialData,
            newPassword: newPasswordReset,
          }
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      alert('パスワードを正常に再設定しました！新しいパスワードでログインしてください。');
      setStep('login');
      setEmail(forgotEmail);
      setPassword('');
      setForgotEmail('');
      setNewPasswordReset('');
      setConfirmPasswordReset('');
    } catch (error: any) {
      setErrorMessage('パスワードの更新に失敗しました。');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isModified) return;
    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      setUpdateMessage('エラー: 新しいパスワードが一致しません。');
      return;
    }
    setUpdateMessage('');
    setStep('confirm');
  };

  const handleTriggerSave = async () => {
    if (isFieldChanged('email')) {
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedCode(verificationCode);
      setInputCode('');
      setErrorMessage('');

      try {
        setAuthLoading(true);
        const res = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email.trim().toLowerCase(), code: verificationCode }),
        });
        const result = await res.json();
        if (!res.ok) {
          throw new Error(result.error || '新しいメールアドレスへの送信に失敗しました');
        }
      } catch (e: any) {
        setErrorMessage(`エラー: ${e.message}`);
        setStep('confirm');
        setAuthLoading(false);
        return;
      } finally {
        setAuthLoading(false);
      }

      setStep('email_mfa');
    } else {
      await executeSave();
    }
  };

  const handleVerifyEmailMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    // ★ セキュリティ修正: 固定コード '123456' を排除
    if (inputCode === generatedCode) {
      await executeSave();
    } else {
      setErrorMessage('認証コードが間違っています。');
    }
  };

  const executeSave = async () => {
    if (!currentUserUid) return;
    try {
      setAuthLoading(true);
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: currentUserUid,
          formData,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'データの保存に失敗しました');
      }

      if (currentUserUid !== formData.email.trim().toLowerCase()) {
        setCurrentUserUid(formData.email.trim().toLowerCase());
      }

      setInitialData({ ...formData, currentPasswordForAuth: '', newPassword: '', confirmPassword: '' });
      setIsDataLoaded(false);
      setUpdateMessage('登録情報を正常に上書き保存しました！');
      setStep('dashboard');
      setTimeout(() => setUpdateMessage(''), 4000);
    } catch (error: any) {
      setUpdateMessage(`エラー: ${error.message || 'データの保存に失敗しました'}`);
      setStep('dashboard');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    setStep('login');
    setPassword('');
    setInputCode('');
    setGeneratedCode('');
    setCurrentUserUid(null);
    setIsDataLoaded(false);
  };

  return (
    <>
      <style jsx global>{`
        @media (max-width: 640px) {
          .responsive-grid {
            grid-template-columns: 1fr !important;
          }
          .responsive-container {
            padding: 20px 16px !important;
            border-radius: 16px !important;
          }
          .responsive-header {
            flex-direction: column !important;
            gap: 16px !important;
            align-items: flex-start !important;
          }
          .responsive-header-actions {
            width: 100% !important;
            justify-content: space-between !important;
          }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '30px 16px', boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif' }}>
        {step === 'login' && (
          <div style={{ width: '100%', maxWidth: '560px', margin: '40px auto', background: '#ffffff', borderRadius: '24px', padding: '40px 24px', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.08)', boxSizing: 'border-box' }} className="responsive-container">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <img src="/lion1.png" alt="ライオン1" style={{ width: '90px', height: '90px', objectFit: 'contain', marginRight: '-70px', zIndex: 2 }} />
              <img src="/nv-logo.png" alt="Logo" style={{ width: '280px', height: '130px', objectFit: 'contain', zIndex: 1 }} />
              <img src="/lion2.png" alt="ライオン2" style={{ width: '90px', height: '90px', objectFit: 'contain', marginLeft: '-70px', zIndex: 2 }} />
            </div>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#166534', margin: '0 0 8px 0' }}>ネクビジョ マイページログイン</h2>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>IDとパスワードを入力してください</p>
            </div>
            {errorMessage && <div style={{ background: '#fef2f2', color: '#991b1b', padding: '12px', borderRadius: '12px', fontSize: '13px', marginBottom: '20px' }}>⚠️ {errorMessage}</div>}
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: '#475569' }}>メールアドレス (ID)</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="example@email.com" style={{ width: '100%', padding: '14px 16px', border: '1.5px solid #e2e8f0', borderRadius: '12px', boxSizing: 'border-box', background: '#f8fafc', color: '#0f172a', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: '#475569' }}>パスワード</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ width: '100%', padding: '14px 16px', border: '1.5px solid #e2e8f0', borderRadius: '12px', boxSizing: 'border-box', background: '#f8fafc', color: '#0f172a', outline: 'none' }} />
              </div>
              <button type="submit" disabled={authLoading} style={{ width: '100%', padding: '15px', background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', fontSize: '15px' }}>
                {authLoading ? '送信中...' : '2段階認証コードを発行'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button 
                type="button" 
                onClick={() => { setStep('forgot_password'); setErrorMessage(''); setForgotEmail(''); }}
                style={{ background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer', fontSize: '13px', fontWeight: '600', textDecoration: 'underline' }}
              >
                パスワードをお忘れの方はこちら
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <a 
                href="https://account.nexus-vision.net/" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: '#16a34a', fontSize: '13px', fontWeight: '600', textDecoration: 'underline' }}
              >
                新規アカウント作成はこちら
              </a>
            </div>
          </div>
        )}

        {step === 'forgot_password' && (
          <div style={{ width: '100%', maxWidth: '480px', margin: '60px auto', background: '#ffffff', borderRadius: '24px', padding: '40px 24px', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.08)', boxSizing: 'border-box' }} className="responsive-container">
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px', color: '#166534' }}>パスワードの再設定</h2>
              <p style={{ color: '#64748b', fontSize: '13px' }}>登録されているメールアドレスを入力してください。確認コードを送信します。</p>
            </div>
            {errorMessage && <div style={{ background: '#fef2f2', color: '#991b1b', padding: '12px', borderRadius: '12px', fontSize: '13px', marginBottom: '20px', textAlign: 'center' }}>⚠️ {errorMessage}</div>}
            <form onSubmit={handleSendForgotCode} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: '#475569' }}>登録メールアドレス</label>
                <input type="email" required value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="example@email.com" style={{ width: '100%', padding: '14px 16px', border: '1.5px solid #e2e8f0', borderRadius: '12px', boxSizing: 'border-box', background: '#f8fafc', color: '#0f172a', outline: 'none' }} />
              </div>
              <button type="submit" disabled={authLoading} style={{ width: '100%', padding: '15px', background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}>
                {authLoading ? '送信中...' : '確認コードを送信'}
              </button>
              <button type="button" onClick={() => setStep('login')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>← ログイン画面に戻る</button>
            </form>
          </div>
        )}

        {step === 'forgot_reset' && (
          <div style={{ width: '100%', maxWidth: '480px', margin: '60px auto', background: '#ffffff', borderRadius: '24px', padding: '40px 24px', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.08)', boxSizing: 'border-box' }} className="responsive-container">
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px', color: '#166534' }}>新しいパスワードの設定</h2>
              <p style={{ color: '#64748b', fontSize: '13px' }}>メールに届いた確認コードと、新しいパスワードを入力してください。</p>
            </div>
            {errorMessage && <div style={{ background: '#fef2f2', color: '#991b1b', padding: '12px', borderRadius: '12px', fontSize: '13px', marginBottom: '20px', textAlign: 'center' }}>⚠️ {errorMessage}</div>}
            <form onSubmit={handleResetPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: '#64748b' }}>確認コード (6桁)</label>
                <input type="text" required maxLength={6} value={inputCode} onChange={e => setInputCode(e.target.value)} placeholder="123456" style={{ width: '100%', padding: '12px', fontSize: '18px', textAlign: 'center', letterSpacing: '4px', border: '1.5px solid #e2e8f0', borderRadius: '10px', background: '#f8fafc', color: '#0f172a', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: '#64748b' }}>新しいパスワード (6文字以上)</label>
                <input type="password" required value={newPasswordReset} onChange={e => setNewPasswordReset(e.target.value)} placeholder="••••••••" style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '10px', background: '#f8fafc', color: '#0f172a', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: '#64748b' }}>新しいパスワード (確認用)</label>
                <input type="password" required value={confirmPasswordReset} onChange={e => setConfirmPasswordReset(e.target.value)} placeholder="••••••••" style={{ width: '100%', padding: '12px', border: '1.5px solid #e2e8f0', borderRadius: '10px', background: '#f8fafc', color: '#0f172a', boxSizing: 'border-box' }} />
              </div>
              <button type="submit" disabled={authLoading} style={{ width: '100%', padding: '15px', background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', marginTop: '10px' }}>
                {authLoading ? '更新中...' : 'パスワードを再設定して完了'}
              </button>
              <button type="button" onClick={() => setStep('forgot_password')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>← 戻る</button>
            </form>
          </div>
        )}

        {step === 'mfa' && (
          <div style={{ width: '100%', maxWidth: '480px', margin: '60px auto', background: '#ffffff', borderRadius: '24px', padding: '40px 24px', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.08)', boxSizing: 'border-box' }} className="responsive-container">
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px', color: '#166534' }}>2段階認証</h2>
              <p style={{ color: '#64748b', fontSize: '13px' }}>登録メールアドレス宛てに送信されたコードを入力してください。</p>
            </div>
            {errorMessage && <div style={{ background: '#fef2f2', color: '#991b1b', padding: '12px', borderRadius: '12px', fontSize: '13px', marginBottom: '20px', textAlign: 'center' }}>⚠️ {errorMessage}</div>}
            <form onSubmit={handleVerifyMfa} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <input type="text" required maxLength={6} value={inputCode} onChange={e => setInputCode(e.target.value)} placeholder="123456" style={{ width: '100%', padding: '16px', fontSize: '24px', textAlign: 'center', letterSpacing: '8px', border: '1.5px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc', color: '#0f172a', boxSizing: 'border-box', outline: 'none' }} />
              <button type="submit" disabled={authLoading} style={{ width: '100%', padding: '15px', background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}>
                {authLoading ? '認証中...' : '認証してログイン'}
              </button>
              <button type="button" onClick={() => setStep('login')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>← 戻る</button>
            </form>
          </div>
        )}

        {step === 'email_mfa' && (
          <div style={{ width: '100%', maxWidth: '480px', margin: '60px auto', background: '#ffffff', borderRadius: '24px', padding: '40px 24px', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.08)', boxSizing: 'border-box' }} className="responsive-container">
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px', color: '#166534' }}>新しいメールアドレスの認証</h2>
              <p style={{ color: '#64748b', fontSize: '13px' }}>変更先の新しいメールアドレス宛てに送信された認証コードを入力してください。</p>
            </div>
            {errorMessage && <div style={{ background: '#fef2f2', color: '#991b1b', padding: '12px', borderRadius: '12px', fontSize: '13px', marginBottom: '20px', textAlign: 'center' }}>⚠️ {errorMessage}</div>}
            <form onSubmit={handleVerifyEmailMfa} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <input type="text" required maxLength={6} value={inputCode} onChange={e => setInputCode(e.target.value)} placeholder="123456" style={{ width: '100%', padding: '16px', fontSize: '24px', textAlign: 'center', letterSpacing: '8px', border: '1.5px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc', color: '#0f172a', boxSizing: 'border-box', outline: 'none' }} />
              <button type="submit" disabled={authLoading} style={{ width: '100%', padding: '15px', background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}>
                {authLoading ? '確認中...' : '認証して保存を完了する'}
              </button>
              <button type="button" onClick={() => setStep('confirm')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>← 確認画面に戻る</button>
            </form>
          </div>
        )}

        {step === 'confirm' && (
          <div style={{ width: '100%', maxWidth: '720px', margin: '20px auto', background: '#ffffff', borderRadius: '24px', padding: '40px 24px', boxShadow: '0 20px 40px rgba(0,0,0,0.06)', boxSizing: 'border-box' }} className="responsive-container">
            <div className="responsive-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px', borderBottom: '1px solid #e2e8f0', paddingBottom: '20px' }}>
              <img src="/lion1.png" alt="ライオン1" style={{ width: '75px', height: '75px', objectFit: 'contain', flexShrink: 0 }} />
              <div style={{ textAlign: 'center', flex: 1, padding: '0 12px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#166534', margin: '0 0 6px 0' }}>変更内容の確認</h1>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>以下の内容に変更します。よろしければ「変更内容を保存する」を押してください。</p>
              </div>
              <img src="/lion2.png" alt="ライオン2" style={{ width: '75px', height: '75px', objectFit: 'contain', flexShrink: 0 }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '30px' }}>
              {targetKeys.filter(key => isFieldChanged(key as keyof typeof formData)).length === 0 ? (
                <p style={{ textAlign: 'center', color: '#64748b', fontSize: '14px' }}>変更された項目はありません。</p>
              ) : (
                targetKeys.filter(key => isFieldChanged(key as keyof typeof formData)).map(key => {
                  const label = fieldLabels[key] || key;
                  const oldValue = (initialData as any)[key] || '(なし)';
                  const newValue = key === 'newPassword' ? '•••••••• (変更あり)' : (formData as any)[key];
                  return (
                    <div key={key} style={{ background: '#f8fafc', border: '1.5px solid #bbf7d0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px', boxSizing: 'border-box' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#166534' }}>✨ {label} の変更</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', flexWrap: 'wrap' }}>
                        <span style={{ color: '#94a3b8', textDecoration: 'line-through', wordBreak: 'break-all' }}>{oldValue}</span>
                        <span style={{ color: '#166534', fontWeight: 'bold' }}>➔</span>
                        <span style={{ color: '#0f172a', fontWeight: '700', wordBreak: 'break-all' }}>{newValue}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {isFieldChanged('email') && (
              <div style={{ marginBottom: '24px', padding: '16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', boxSizing: 'border-box' }}>
                <p style={{ fontSize: '13px', color: '#166534', margin: 0, fontWeight: '700' }}>
                  💡 メールアドレスを変更するため、新しいアドレス宛てに2段階認証コードが送信されます。
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setStep('dashboard')} style={{ flex: 1, minWidth: '140px', padding: '15px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}>戻って修正する</button>
              <button type="button" disabled={authLoading} onClick={handleTriggerSave} style={{ flex: 1, minWidth: '140px', padding: '15px', background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}>
                {authLoading ? '送信中...' : '変更内容を保存する'}
              </button>
            </div>
          </div>
        )}

        {step === 'dashboard' && (
          <div style={{ width: '100%', maxWidth: '720px', margin: '20px auto', background: '#ffffff', borderRadius: '24px', padding: '40px 24px', boxShadow: '0 20px 40px rgba(0,0,0,0.06)', boxSizing: 'border-box' }} className="responsive-container">
            <div className="responsive-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #e2e8f0', paddingBottom: '20px' }}>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#166534', margin: '0 0 4px 0' }}>ネクビジョ マイページ</h1>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>登録情報の確認・変更が行えます</p>
              </div>
              <div className="responsive-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <img src="/lion1.png" alt="ライオン1" style={{ width: '65px', height: '65px', objectFit: 'contain' }} />
                  <img src="/lion2.png" alt="ライオン2" style={{ width: '65px', height: '65px', objectFit: 'contain' }} />
                </div>
                <button onClick={handleLogout} style={{ padding: '10px 18px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>ログアウト</button>
              </div>
            </div>

            {updateMessage && <div style={{ background: updateMessage.includes('エラー') ? '#fef2f2' : '#f0fdf4', color: updateMessage.includes('エラー') ? '#991b1b' : '#166534', padding: '14px', borderRadius: '12px', fontSize: '14px', marginBottom: '24px', border: `1px solid ${updateMessage.includes('エラー') ? '#fee2e2' : '#bbf7d0'}`, fontWeight: '600', textAlign: 'center' }}>{updateMessage}</div>}

            <form onSubmit={handleProceedToConfirm} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '6px', color: isFieldChanged('lastName') ? '#16a34a' : '#475569' }}>
                    {isFieldChanged('lastName') ? '✨ お名前 (姓) [変更あり]' : 'お名前 (姓)'}
                  </label>
                  <input type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} style={getInputStyle('lastName')} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '6px', color: isFieldChanged('firstName') ? '#16a34a' : '#475569' }}>
                    {isFieldChanged('firstName') ? '✨ お名前 (名) [変更あり]' : 'お名前 (名)'}
                  </label>
                  <input type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} style={getInputStyle('firstName')} />
                </div>
              </div>

              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '6px', color: isFieldChanged('lastNameKana') ? '#16a34a' : '#475569' }}>
                    {isFieldChanged('lastNameKana') ? '✨ フリガナ (セイ) [変更あり]' : 'フリガナ (セイ)'}
                  </label>
                  <input type="text" value={formData.lastNameKana} onChange={e => setFormData({...formData, lastNameKana: e.target.value})} style={getInputStyle('lastNameKana')} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '6px', color: isFieldChanged('firstNameKana') ? '#16a34a' : '#475569' }}>
                    {isFieldChanged('firstNameKana') ? '✨ フリガナ (メイ) [変更あり]' : 'フリガナ (メイ)'}
                  </label>
                  <input type="text" value={formData.firstNameKana} onChange={e => setFormData({...formData, firstNameKana: e.target.value})} style={getInputStyle('firstNameKana')} />
                </div>
              </div>

              <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '6px', color: isFieldChanged('birthdate') ? '#16a34a' : '#475569' }}>
                    {isFieldChanged('birthdate') ? '✨ 生年月日 [変更あり]' : '生年月日'}
                  </label>
                  <input type="date" value={formData.birthdate} onChange={e => setFormData({...formData, birthdate: e.target.value})} style={getInputStyle('birthdate')} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '6px', color: isFieldChanged('phone') ? '#16a34a' : '#475569' }}>
                    {isFieldChanged('phone') ? '✨ 電話番号 (自動ハイフン) [変更あり]' : '電話番号 (自動ハイフン)'}
                  </label>
                  <input type="text" value={formData.phone} onChange={e => handlePhoneChange(e.target.value)} placeholder="05000000000" maxLength={13} style={getInputStyle('phone')} />
                </div>
              </div>

              <div style={{ border: '1.5px solid #e2e8f0', borderRadius: '16px', padding: '20px', background: '#fcfdfd', display: 'flex', flexDirection: 'column', gap: '14px', boxSizing: 'border-box' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#334151' }}>ご住所</span>
                
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: isFieldChanged('postalCode') ? '#16a34a' : '#64748b' }}>
                    郵便番号 (7桁入力で自動反映) {isFieldChanged('postalCode') && '[変更あり]'}
                  </label>
                  <input type="text" value={formData.postalCode} onChange={e => handlePostalCodeChange(e.target.value)} placeholder="例: 9800021" maxLength={7} style={getInputStyle('postalCode')} />
                </div>

                <div className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: isFieldChanged('prefecture') ? '#16a34a' : '#64748b' }}>都道府県</label>
                    <input type="text" value={formData.prefecture} readOnly placeholder="自動入力" style={{ ...getInputStyle('prefecture'), background: '#f1f5f9', color: '#64748b' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: isFieldChanged('city') ? '#16a34a' : '#64748b' }}>市区町村・町域</label>
                    <input type="text" value={formData.city} readOnly placeholder="自動入力" style={{ ...getInputStyle('city'), background: '#f1f5f9', color: '#64748b' }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: isFieldChanged('addressLine') ? '#16a34a' : '#64748b' }}>
                    それ以降の住所 (番地など) {isFieldChanged('addressLine') && '[変更あり]'}
                  </label>
                  <input type="text" value={formData.addressLine} onChange={e => setFormData({...formData, addressLine: e.target.value})} placeholder="例: 中央1-1-1" style={getInputStyle('addressLine')} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: isFieldChanged('building') ? '#16a34a' : '#64748b' }}>
                    建物名・部屋番号 (任意) {isFieldChanged('building') && '[変更あり]'}
                  </label>
                  <input type="text" value={formData.building} onChange={e => setFormData({...formData, building: e.target.value})} placeholder="例: ○○ビル 302号室" style={getInputStyle('building')} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '6px', color: isFieldChanged('email') ? '#16a34a' : '#475569' }}>
                  {isFieldChanged('email') ? '✨ メールアドレス (ログインID) [変更あり]' : 'メールアドレス (ログインID)'}
                </label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={getInputStyle('email')} />
              </div>

              <div style={{ border: '1.5px solid #e2e8f0', borderRadius: '16px', padding: '20px', background: '#fcfdfd', display: 'flex', flexDirection: 'column', gap: '14px', boxSizing: 'border-box' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#334151' }}>パスワード変更 (変更する場合のみ入力)</span>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: isFieldChanged('newPassword') ? '#16a34a' : '#64748b' }}>
                    {isFieldChanged('newPassword') ? '新しいパスワード (6文字以上) [変更あり]' : '新しいパスワード (6文字以上)'}
                  </label>
                  <input type="password" value={formData.newPassword} onChange={e => setFormData({...formData, newPassword: e.target.value})} placeholder="••••••••" style={getInputStyle('newPassword')} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', marginBottom: '4px', color: isFieldChanged('confirmPassword') ? '#16a34a' : '#64748b' }}>
                    {isFieldChanged('confirmPassword') ? '新しいパスワード (確認用) [変更あり]' : '新しいパスワード (確認用)'}
                  </label>
                  <input type="password" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} placeholder="••••••••" style={getInputStyle('confirmPassword')} />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={!isModified}
                style={{ 
                  width: '100%', 
                  padding: '15px', 
                  background: isModified ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' : '#cbd5e1', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '12px', 
                  fontWeight: '700', 
                  cursor: isModified ? 'pointer' : 'not-allowed', 
                  fontSize: '15px', 
                  marginTop: '10px', 
                  boxShadow: isModified ? '0 10px 20px -5px rgba(22, 163, 74, 0.4)' : 'none',
                  boxSizing: 'border-box',
                  transition: 'background 0.2s ease, box-shadow 0.2s ease'
                }}
              >
                変更内容を確認
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}