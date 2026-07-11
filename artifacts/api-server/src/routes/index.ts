import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import friendsRouter from "./friends";
import contactsRouter from "./contacts";
import messagesRouter from "./messages";
import callsRouter from "./calls";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(friendsRouter);
router.use(contactsRouter);
router.use(messagesRouter);
router.use(callsRouter);
router.use(adminRouter);

export default router;
