@echo off
echo ==========================================
echo  Shree Ganesh Traders — Daily Reminders
echo ==========================================

D:
cd D:\Freelancing_Projects\Shree_Ganesh_Traders\my-app\backend

call D:\Freelancing_Projects\Shree_Ganesh_Traders\shree_ganesh_env\Scripts\activate.bat

echo Running daily reminder command...
python manage.py send_daily_reminders >> D:\Freelancing_Projects\Shree_Ganesh_Traders\reminders_log.txt 2>&1

echo Done at %date% %time% >> D:\Freelancing_Projects\Shree_Ganesh_Traders\reminders_log.txt

echo Finished. Check reminders_log.txt for details.