import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  StyleSheet,
  View,
} from "react-native";

import { Redirect } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { useAuthStore } from "../store/authStore";
import { hasChildPhoneCredentials } from "../services/childMobileService";
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






  if(
    !isBootstrapped ||
    !minimumSplashFinished ||
    childPhoneLinked === null
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