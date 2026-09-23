import { supabase } from "../lib/supabase";

import type {
  MenuItem,
  MenuPermission,
  RoleSummary,
} from "../types/safetrack";



function mapMenuRow(
  row:any
):MenuItem {

  return {

    id:
      String(row.id),


    menuKey:
      row.menu_key ??
      "",


    menuName:
      row.menu_name ??
      row.name ??
      "",


    route:
      row.route ??
      row.route_path ??
      "",


    icon:
      row.icon ??
      row.icon_name ??
      null,


    displayOrder:
      Number(
        row.display_order ?? 0
      ),

  };

}






function mapPermissionRow(
  row:any
):MenuPermission {

  return {

    roleId:
      row.role_id,


    menuId:
      row.menu_id,


    canView:
      Boolean(
        row.can_view
      ),

  };

}







export async function fetchActiveMenus()
:Promise<MenuItem[]> {


  const {
    data,
    error
  } =
  await supabase

    .from("menus")

    .select("*")

    .eq(
      "is_active",
      true
    )

    .order(
      "display_order",
      {
        ascending:true,
      }
    );



  if(error){

    throw error;

  }



  return (
    data ?? []
  )
  .map(
    mapMenuRow
  );

}







export async function fetchActiveRoles()
:Promise<RoleSummary[]> {


  const {
    data,
    error
  } =
  await supabase

    .from("roles")

    .select(
      `
      id,
      role_code,
      role_name
      `
    )

    .eq(
      "is_active",
      true
    );



  if(error){

    throw error;

  }



  return (

    data ?? []

  )
  .map(
    (row:any)=>({

      id:
        row.id,


      roleCode:
        row.role_code,


      roleName:
        row.role_name,

    })
  );

}







export async function fetchAllMenuPermissions()
:Promise<MenuPermission[]> {


  const {
    data,
    error
  } =
  await supabase

    .from("permissions")

    .select(
      `
      role_id,
      menu_id,
      can_view
      `
    );



  if(error){

    throw error;

  }



  return (

    data ?? []

  )
  .map(
    mapPermissionRow
  );

}








export async function fetchVisibleMenuKeysForRole(
  roleCode:string
):Promise<string[]> {


  const {
    data,
    error
  } =
  await supabase

    .from("permissions")

    .select(
      `
      can_view,
      menus!inner(
        menu_key
      ),
      roles!inner(
        role_code
      )
      `
    )

    .eq(
      "roles.role_code",
      roleCode
    )

    .eq(
      "can_view",
      true
    );



  if(error){

    throw error;

  }



  return (

    data ?? []

  )
  .map(
    (row:any)=>
      row.menus?.menu_key
  )
  .filter(
    Boolean
  );

}








export async function setMenuPermission(
  roleId:string,
  menuId:string,
  canView:boolean
):Promise<void> {


  const {
    error
  } =
  await supabase

    .from("permissions")

    .upsert(

      {

        role_id:
          roleId,


        menu_id:
          menuId,


        can_view:
          canView,

      },

      {

        onConflict:
          "role_id,menu_id",

      }

    );



  if(error){

    throw error;

  }

}