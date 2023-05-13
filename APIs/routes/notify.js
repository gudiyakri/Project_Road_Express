router.post('/payment', function (req, res, next) {
    pool.getConnection((err, db) => {
        if (err) {
            res.send({
                code: 0
            });
        } else {
            var cli = req.body.cli;
            var cust = req.body.cust;
            var trip = req.body.trip;
            // req.body.remaining
            // req.body.money
            if (cli == 1) {
                date_ver = new Date();
                var date_verif = moment.utc(date_ver).utcOffset("+05:30").format('DD/MM/YYYY');
                var time_verif = moment.utc(date_ver).utcOffset("+05:30").format('h:mm a');
                var tot_time = `${date_verif} ${time_verif}`;
                var sqlquery = 'UPDATE payment_table SET tot_save = ?, time = ? WHERE trip_id = ? and cust_id =?';
                db.query(sqlquery, [1, tot_time, trip, cust], (err, result) => {
                    if (err) {
                        return res.send({
                            code: 0
                        });
                    } else {
                        return res.send({
                            msg: 'Trip Completed',
                            code: 1
                        });
                    }
                });
            } else {
                var rem = parseInt(req.body.remaining, 10) - parseInt(req.body.money, 10);
                var paid = 0;
                var sqlquery = 'INSERT INTO `cli_acc`(`trip_id`, `flag`, `amount`) VALUES (?,?,?)';
                db.query(sqlquery,[trip,2,req.body.money],(err,result)=>{
                    if(err) throw err;
                    else{
                        if (rem == 0) {
                            paid = 1;
                            var sqlquery = "UPDATE `pay_cli` SET `paid`= ?,`remaining`= ? WHERE `trip_id` = ? AND `remaining` = ? AND `client_id` = ?";
                            db.query(sqlquery, [paid, rem, trip, req.body.remaining, cust], (err, result) => {
                                if (err) {
                                    res.send({
                                        code: 0
                                    });
                                } else {
                                    var msg = "Trip Completed";
                                    res.send({
                                        msg,
                                        code: 1
                                    });
                                }
                            });
                        } else {
                            var sqlquery = 'SELECT * FROM `cli_rem` WHERE `client_id` = ?';
                            db.query(sqlquery, [cust], (err, result) => {
                                if (err) return res.send({
                                    msg: 'Connection Err in Cli_rem',
                                    code: 0
                                });
                                else if (result.length>0) {
                                    var rem1=parseInt(result[0].rem, 10)-rem;
                                    
                                    
                                        if(rem1>=0){

                                            var sqlquery = "UPDATE `pay_cli` SET `paid`= ?,`remaining`= ? WHERE `trip_id` = ? AND `remaining` = ? AND `client_id` = ?";
                                            db.query(sqlquery, [1,0, trip, req.body.remaining, cust], (err, result) => {
                                                if (err) {
                                                    res.send({
                                                        code: 0
                                                    });
                                                }
                                       

                                                else
                                                {
                                                    var sqlquery = 'UPDATE cli_rem SET rem = ? WHERE client_id = ?';
                                                    db.query(sqlquery, [rem1, cust], (err, result) => {
                                                        if (err) return res.send({
                                                            msg: 'Connection err In Update Cli_rem',
                                                            code: 0
                                                        });
                                                        else
                                                        {
                                                            var sqlquery = 'INSERT INTO `cli_acc`(`trip_id`, `flag`, `amount`) VALUES (?,?,?)';
                                                            db.query(sqlquery, [trip, 1,req.body.money], (err, result) => {
                                                                if (err) return res.send({
                                                                    msg: 'Connection err in cli_acc',
                                                                    code: 0
                                                                });
                                                                else {
                                                                    var msg = "Trip Completed";
                                                                    res.send({
                                                                        msg,
                                                                        code: 1
                                                                    });
                                                                }
                                                            });
                                                        }
                                                    });
        
                                                }

                                            });
                                        }

                                        else
                                        {
                                                    if(parseInt(result[0].rem, 10)>0)
                                                    {
                                                      var rem2=-1*rem1;
                                            var sqlquery = "UPDATE `pay_cli` SET `paid`= ?,`remaining`= ? WHERE `trip_id` = ? AND `remaining` = ? AND `client_id` = ?";
                                            db.query(sqlquery, [0,rem2, trip, req.body.remaining, cust], (err, result) => {
                                                if (err) {
                                                    res.send({
                                                        code: 0
                                                    });
                                                }
                                                else{
                                                    var sqlquery = 'UPDATE cli_rem SET rem = ? WHERE client_id = ?';
                                                    db.query(sqlquery, [rem1, cust], (err, result) => {
                                                        if (err) return res.send({
                                                            msg: 'Connection err In Update Cli_rem',
                                                            code: 0
                                                        });
                                                        else{
                                                            var sqlquery = 'INSERT INTO `cli_acc`(`trip_id`, `flag`, `amount`) VALUES (?,?,?)';
                                                            db.query(sqlquery, [trip, 1,parseInt(result[0].rem, 10)], (err, result) => {
                                                                if (err) return res.send({
                                                                    msg: 'Connection err in cli_acc',
                                                                    code: 0
                                                                });
                                                                else {
                                                                    var msg = "Trip Completed";
                                                                    res.send({
                                                                        msg,
                                                                        code: 1
                                                                    });
                                                                }
                                                            });

                                                        }
                                                    });

                                                }
                                            });
                                            }
                                            else
                                            {
                                                var sqlquery = "UPDATE `pay_cli` SET `paid`= ?,`remaining`= ? WHERE `trip_id` = ? AND `remaining` = ? AND `client_id` = ?";
                                            db.query(sqlquery, [0,rem, trip, req.body.remaining, cust], (err, result) => {
                                                if (err) {
                                                    res.send({
                                                        code: 0
                                                    });
                                                }
                                                else{
                                                    var sqlquery = 'UPDATE cli_rem SET rem = ? WHERE client_id = ?';
                                                    db.query(sqlquery, [rem1, cust], (err, result) => {
                                                        if (err) return res.send({
                                                            msg: 'Connection err In Update Cli_rem',
                                                            code: 0
                                                        });
                                                        else
                                                        {
                                                            res.send({
                                                                code: 0
                                                            });
                                                        }
                                                       
                                                    });

                                                }
                                            });

                                            }

                                        }
                                       
                                        var newRem = result[0].rem;
                                        var orem = parseInt(req.body.remaining, 10) - parseInt(req.body.money, 10)
                                        var sqlquery = "UPDATE `pay_cli` SET `paid`= ?,`remaining`= ? WHERE `trip_id` = ? AND `remaining` = ? AND `client_id` = ?";
                                        db.query(sqlquery, [paid, orem, trip, req.body.remaining, cust], (err, result) => {
                                            if (err) {
                                                res.send({
                                                    code: 0
                                                });
                                            } else {
                                                var sqlquery = 'UPDATE cli_rem SET rem = ? WHERE client_id = ?';
                                                db.query(sqlquery, [remx, cust], (err, result) => {
                                                    if (err) return res.send({
                                                        msg: 'Connection err In Update Cli_rem',
                                                        code: 0
                                                    });
                                                    else {
                                                        if(rem >0){
                                                            var sqlquery = 'INSERT INTO `cli_acc`(`trip_id`, `flag`, `amount`) VALUES (?,?,?)';
                                                            db.query(sqlquery, [trip, 1, newRem], (err, result) => {
                                                                if (err) return res.send({
                                                                    msg: 'Connection err in cli_acc',
                                                                    code: 0
                                                                });
                                                                else {
                                                                    var msg = "Trip Completed";
                                                                    res.send({
                                                                        msg,
                                                                        code: 1
                                                                    });
                                                                }
                                                            });
                                                        }else{
                                                            var msg = "Trip Completed";
                                                                    res.send({
                                                                        msg,
                                                                        code: 1
                                                                    });
                                                        }
                                                    }
                                                });
                                            }
                                        });
                                     else if (rem <= parseInt(result[0].rem, 10)) {
                                        var newRem = parseInt(result[0].rem, 10) - rem;
                                        paid = 1;
                                        var sqlquery = "UPDATE `pay_cli` SET `paid`= ?,`remaining`= ? WHERE `trip_id` = ? AND `remaining` = ? AND `client_id` = ?";
                                        db.query(sqlquery, [paid, 0, trip, req.body.remaining, cust], (err, result) => {
                                            if (err) return res.send({
                                                msg: 'Connection Err in rem pay_cli',
                                                code: 0
                                            });
                                            else {
                                                var sqlquery = 'UPDATE cli_rem SET rem = ? WHERE client_id = ?';
                                                db.query(sqlquery, [newRem, cust], (err, result) => {
                                                    if (err) return res.send({
                                                        msg: 'Connection err in rem cli_rem',
                                                        code: 0
                                                    });
                                                    else {
                                                        var sqlquery = 'INSERT INTO `cli_acc`(`trip_id`, `flag`, `amount`) VALUES (?,?,?)';
                                                        db.query(sqlquery, [trip, 1, rem], (err, result) => {
                                                            if (err) return res.send({
                                                                msg: 'Connection err in rem cli_acc',
                                                                code: 0
                                                            });
                                                            else {
                                                                var msg = "Trip Completed";
                                                                res.send({
                                                                    msg,
                                                                    code: 1
                                                                });
                                                            }
                                                        });
                                                    }
                                                });
                                            }
                                        });
                                    }
                                } else {
                                    var sqlquery = "UPDATE `pay_cli` SET `paid`= ?,`remaining`= ? WHERE `trip_id` = ? AND `remaining` = ? AND `client_id` = ?";
                                    db.query(sqlquery, [paid, rem, trip, req.body.remaining, cust], (err, result) => {
                                        if (err) {
                                            res.send({
                                                code: 0
                                            });
                                        } else {
                                            rem = rem*-1;
                                            var sqlquery = 'INSERT INTO cli_rem(rem,client_id) VALUES(?,?)';
                                            db.query(sqlquery,[rem,cust],(err,db)=>{
                                                if(err) return res.send({code:0});
                                                else{
                                                    var msg = "Trip Completed";
                                                    res.send({
                                                        msg,
                                                        code: 1
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    }
                });
            }
            db.release();
        }
    });
});

