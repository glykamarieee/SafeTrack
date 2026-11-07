import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Platform,
  StyleSheet,
  View,
} from "react-native";

import { Redirect } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { useAuthStore } from "../store/authStore";
import { hasChildPhoneCredentials } from "../services/childMobileService";
import { needsWelcomeGuide } from "../services/onboardingService";
import { openedByNewResetLink } from "../lib/deepLinks";
import { StartSplash } from "../components/StartSplash";



export default function SplashScreen() {


  const bootstrap =
    useAuthStore(
      (state) => state.bootstrap
    );


  const isBootstrapped =
    useAuthStore(
      (state) => state.isBootstrapped
    );


  const session =
    useAuthStore(
      (state) => state.session
    );


  const role =
    useAuthStore(
      (state) => state.role
    );



  const [minimumSplashFinished, setMinimumSplashFinished] =
    useState(false);

  // A linked child phone has no account session; its link is saved on the
  // device. Without this check it reopened on the welcome screen every time.
  const [childPhoneLinked, setChildPhoneLinked] =
    useState<boolean | null>(null);

  // The welcome guide is for the phone app; the admin website doesn't show it.
  const [showWelcomeGuide, setShowWelcomeGuide] =
    useState<boolean | null>(Platform.OS === "web" ? false : null);

  useEffect(() => {
    if (Platform.OS === "web") return;
    let active = true;
    needsWelcomeGuide()
      .then((needed) => active && setShowWelcomeGuide(needed))
      .catch(() => active && setShowWelcomeGuide(false));
    return () => {
      active = false;
    };
  }, []);

  // A password-reset link that started the app opens Reset password, not the
  // usual start (it showed Get started before).
  const [openedByResetLink, setOpenedByResetLink] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    openedByNewResetLink()
      .then((reset) => active && setOpenedByResetLink(reset))
      .catch(() => active && setOpenedByResetLink(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    hasChildPhoneCredentials()
      .then((linked) => active && setChildPhoneLinked(linked))
      .catch(() => active && setChildPhoneLinked(false));
    return () => {
      active = false;
    };
  }, []);



  const logoOpacity =
    useRef(
      new Animated.Value(0.55)
    ).current;



  const logoScale =
    useRef(
      new Animated.Value(0.96)
    ).current;





  useEffect(() => {


    void bootstrap();



    const timer =
      setTimeout(() => {

        setMinimumSplashFinished(true);

      }, 1800);





    const animation =
      Animated.loop(

        Animated.sequence([


          Animated.parallel([

            Animated.timing(
              logoOpacity,
              {
                toValue:1,
                duration:850,
                useNativeDriver:true,
              }
            ),


            Animated.timing(
              logoScale,
              {
                toValue:1,
                duration:850,
                useNativeDriver:true,
              }
            ),

          ]),





          Animated.parallel([

            Animated.timing(
              logoOpacity,
              {
                toValue:0.72,
                duration:850,
                useNativeDriver:true,
              }
            ),


            Animated.timing(
              logoScale,
              {
                toValue:0.98,
                duration:850,
                useNativeDriver:true,
              }
            ),

          ]),


        ])

      );



    animation.start();




    return () => {

      clearTimeout(timer);

      animation.stop();

    };


  },[
    bootstrap,
    logoOpacity,
    logoScale
  ]);






  if (openedByResetLink) {
    return <Redirect href="/(auth)/reset-password" />;
  }

  if(
    !isBootstrapped ||
    !minimumSplashFinished ||
    childPhoneLinked === null ||
    showWelcomeGuide === null ||
    openedByResetLink === null
  ){

    return <StartSplash />;

  }







  /*
   * No active session:
   *
   * Show SafeTrack introduction video.
   *
   * User decides:
   * Get Started -> Register
   * Sign In -> Login
   */

  if(!session && childPhoneLinked){

    return <Redirect href="/(child)/child-home" />;

  }

  if(!session && showWelcomeGuide){

    return (

      <Redirect
        href={{ pathname: "/onboarding", params: { audience: "welcome" } }}
      />

    );

  }

  if(!session){

    return (

      <Redirect
        href="/(auth)/welcome"
      />

    );

  }






  /*
   * Guardian Mobile Application
   *
   * Always enter Guardian dashboard.
   *
   * Child registration will be handled
   * inside the dashboard, not forced here.
   */

  if(role==="guardian"){

    return (

      <Redirect
        href="/(app)/home"
      />

    );

  }







  /*
   * Admin account
   *
   * Temporary route.
   *
   * Final implementation:
   * Admin goes to responsive web dashboard.
   */

  if(role==="admin"){

    return (

      <Redirect
        href="/(app)/admin-dashboard"
      />

    );

  }






  /*
   * Unknown role fallback
   */

  return (

    <Redirect
      href="/(auth)/login"
    />

  );


}







const styles = StyleSheet.create({


  container:{

    flex:1,

    backgroundColor:"#2B7A53",

    alignItems:"center",

    justifyContent:"center",

  },



  logoWrap:{

    alignItems:"center",

    justifyContent:"center",

  },



  logo:{

    width:210,

    height:145,

  },


});