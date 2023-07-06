// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import {
	getFirestore,
	connectFirestoreEmulator,
	addDoc,
	collection,
	serverTimestamp,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDPPFuFPeJDczctD30in-gjVz09LhwmOKo",
  authDomain: "fireworks-game-dev.firebaseapp.com",
  projectId: "fireworks-game-dev",
  storageBucket: "fireworks-game-dev.appspot.com",
  messagingSenderId: "629759544267",
  appId: "1:629759544267:web:a3182bd9997a9e01d2044e"
};

export const firebase = {
	app: initializeApp(firebaseConfig),
	firestore: getFirestore(),
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	dispatch: (action: any) => {
		addDoc(collection(firebase.firestore, 'actions'), {
			...action,
			timestamp: serverTimestamp()
		}).catch((message) => {
			console.error(message);
		});
	},
};

// TODO: don't do this in production
connectFirestoreEmulator(firebase.firestore, 'localhost', 8888);