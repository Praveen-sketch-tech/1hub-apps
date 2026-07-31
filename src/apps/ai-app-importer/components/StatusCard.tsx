
import React from "react";

export default function StatusCard({status}:{status:any}){

  return(

    <div className="rounded-xl border p-4 mt-4">

      <div>Total Files : {status.total}</div>

      <div className="text-green-600">
        Valid : {status.valid}
      </div>

      <div className="text-red-600">
        Errors : {status.invalid}
      </div>

    </div>

  );

}
