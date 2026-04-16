import admin from 'firebase-admin';

export async function deleteInactiveAccounts() {
  const db = admin.firestore();
  const oneTwentyDaysAgo = new Date();
  oneTwentyDaysAgo.setDate(oneTwentyDaysAgo.getDate() - 120);
  const cutoff = oneTwentyDaysAgo.getTime();

  const usersRef = db.collection('users');
  const snapshot = await usersRef.where('logoutTimestamp', '<=', cutoff).get();

  const batch = db.batch();
  snapshot.forEach(doc => {
    const userData = doc.data();
    // Admin is exempt
    if (userData.role === 'admin') return;
    batch.delete(doc.ref);
  });
  await batch.commit();
  console.log(`Deleted ${snapshot.size} inactive accounts.`);
}
