import type { ColorValue } from "react-native";

import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuthStore } from "../../store/authStore";
import { useGuardianPushRegistration } from "../../hooks/useGuardianPushRegistration";

import {
  safeTrackColors as colors,
  safeTrackShadow as shadow,
} from "../../constants/safeTrackDesign";


function Icon(
  name:keyof typeof Ionicons.glyphMap
){

  return ({
    color,
    size,
  }:{
    color:ColorValue;
    size:number;
  }) => (

    <Ionicons
      name={name}
      size={size}
      color={color}
    />

  );

}



export default function AppLayout(){


  const role =
    useAuthStore(
      state=>state.role
    );


  useGuardianPushRegistration(
    role==="guardian"
  );



  return (

    <Tabs

      screenOptions={{

        headerShown:false,

        tabBarActiveTintColor:
          colors.primary,

        tabBarInactiveTintColor:
          colors.muted,


        tabBarStyle:{

          height:72,

          paddingTop:8,

          paddingBottom:10,

          backgroundColor:
            colors.white,

          borderTopColor:
            colors.border,

          ...shadow.soft,

        },


      }}

    >


      <Tabs.Screen

        name="home"

        options={{

          title:"Home",

          tabBarIcon:
            Icon("home-outline"),

        }}

      />



      <Tabs.Screen

        name="location"

        options={{

          title:"Location",

          tabBarIcon:
            Icon("location-outline"),

        }}

      />



      <Tabs.Screen

        name="safety-center"

        options={{

          title:"Safety",

          tabBarIcon:
            Icon("shield-checkmark-outline"),

        }}

      />



      <Tabs.Screen

        name="history"

        options={{

          title:"Activity",

          tabBarIcon:
            Icon("time-outline"),

        }}

      />



      <Tabs.Screen

        name="profile"

        options={{

          title:"Profile",

          tabBarIcon:
            Icon("person-outline"),

        }}

      />



      {/* EVERYTHING ELSE HIDDEN */}

      <Tabs.Screen
        name="notifications"
        options={{href:null}}
      />

      <Tabs.Screen
        name="reports"
        options={{href:null}}
      />

      <Tabs.Screen
        name="safe-zones"
        options={{href:null}}
      />

      <Tabs.Screen
        name="help-support"
        options={{href:null}}
      />

      <Tabs.Screen
        name="manage-access"
        options={{href:null}}
      />

      <Tabs.Screen
        name="connection-code"
        options={{href:null}}
      />

      <Tabs.Screen
        name="device-connection"
        options={{href:null}}
      />

      <Tabs.Screen
        name="device-connection-code"
        options={{href:null}}
      />

      <Tabs.Screen
        name="sos-alerts"
        options={{href:null}}
      />

      {/* ADMIN */}

      <Tabs.Screen
        name="admin-dashboard"
        options={{href:null}}
      />

      <Tabs.Screen
        name="admin-guardians"
        options={{href:null}}
      />

      <Tabs.Screen
        name="admin-devices"
        options={{href:null}}
      />

      <Tabs.Screen
        name="admin-reports"
        options={{href:null}}
      />

      <Tabs.Screen
        name="admin-profile"
        options={{href:null}}
      />


      {/* DETAILS */}

      <Tabs.Screen
        name="child-profile"
        options={{href:null}}
      />

      <Tabs.Screen
        name="activity-map"
        options={{href:null}}
      />

      <Tabs.Screen
        name="anomaly-details"
        options={{href:null}}
      />

      <Tabs.Screen
        name="admin-device-details"
        options={{href:null}}
      />

      <Tabs.Screen
        name="admin-guardian-details"
        options={{href:null}}
      />

      <Tabs.Screen
        name="edit-child-profile"
        options={{href:null}}
      />

      <Tabs.Screen
        name="edit-guardian-profile"
        options={{href:null}}
      />


    </Tabs>

  );

}